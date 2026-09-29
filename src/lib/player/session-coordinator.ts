import type { TrackSummary } from '#lib/tidal/models.js';
import { isQueueEntryId, type QueueEntry } from './queue-entry.js';
import { rebaseQueue, type QueueCommand } from './playback-reconciliation.js';

export type PlaybackOrigin = 'listening-room' | 'halflight-now';

export interface PlaybackDeviceStatus {
	origin: PlaybackOrigin;
	expiresAt: string;
	isCurrent: boolean;
}

export interface SavedPlaybackState {
	currentTrack: TrackSummary | null;
	queue: QueueEntry[];
	history: TrackSummary[];
	currentTime: number;
	revision?: number;
	lastOrigin?: PlaybackOrigin | null;
	activeDevice?: PlaybackDeviceStatus | null;
}

export interface PlaybackStateWrite extends SavedPlaybackState {
	revision: number;
	origin: PlaybackOrigin;
}

export interface PlaybackPersistenceSnapshot extends PlaybackStateWrite {
	queueCommands: QueueCommand[];
}

export type PlaybackPersistenceStatus =
	'saved' | 'saving' | 'offline' | 'server_error' | 'conflict' | 'rejected' | 'unauthenticated';

export function isTrackSummary(value: unknown): value is TrackSummary {
	if (!value || typeof value !== 'object') return false;
	const track = value as Record<string, unknown>;
	return (
		track.kind === 'track' &&
		typeof track.id === 'string' &&
		track.id.length > 0 &&
		typeof track.title === 'string' &&
		track.title.length > 0 &&
		Array.isArray(track.artists) &&
		track.artists.every(
			(artist) =>
				artist &&
				typeof artist === 'object' &&
				typeof (artist as { id?: unknown }).id === 'string' &&
				typeof (artist as { name?: unknown }).name === 'string'
		)
	);
}

export function isPlaybackDeviceStatus(value: unknown): value is PlaybackDeviceStatus {
	if (!value || typeof value !== 'object') return false;
	const device = value as Record<string, unknown>;
	return (
		(device.origin === 'listening-room' || device.origin === 'halflight-now') &&
		typeof device.expiresAt === 'string' &&
		Number.isFinite(Date.parse(device.expiresAt)) &&
		typeof device.isCurrent === 'boolean'
	);
}

export function isSavedPlaybackState(
	value: unknown
): value is SavedPlaybackState & { revision: number } {
	if (!value || typeof value !== 'object') return false;
	const state = value as Record<string, unknown>;
	return (
		(state.currentTrack === null || isTrackSummary(state.currentTrack)) &&
		Array.isArray(state.queue) &&
		state.queue.every((entry) => {
			return (
				isTrackSummary(entry) &&
				typeof entry === 'object' &&
				entry !== null &&
				isQueueEntryId((entry as QueueEntry).entryId)
			);
		}) &&
		Array.isArray(state.history) &&
		state.history.every(isTrackSummary) &&
		typeof state.currentTime === 'number' &&
		Number.isFinite(state.currentTime) &&
		state.currentTime >= 0 &&
		typeof state.revision === 'number' &&
		Number.isSafeInteger(state.revision) &&
		state.revision >= 0 &&
		(state.activeDevice === undefined ||
			state.activeDevice === null ||
			isPlaybackDeviceStatus(state.activeDevice))
	);
}

export interface SessionCoordinatorOptions {
	origin: PlaybackOrigin | (() => PlaybackOrigin);
	fetch?: typeof fetch;
	getDeviceId?: () => string | null;
	getCurrentState: () => {
		currentTrack: TrackSummary | null;
		queue: QueueEntry[];
		history: TrackSummary[];
		currentTime: number;
		isPlaying: boolean;
		hasLocalMedia: boolean;
	};
	onApplyQueue: (queue: QueueEntry[]) => void;
	onApplySession?: (state: SavedPlaybackState) => void;
	onStatusChange?: (status: PlaybackPersistenceStatus) => void;
	onActiveDeviceChange?: (device: PlaybackDeviceStatus | null) => void;
	onHydrateMetadata?: (tracks: TrackSummary[]) => void;
	onQueueCommandsChange?: (commands: readonly QueueCommand[]) => void;
	canPersist?: () => boolean;
	maxQueueLength?: number;
	maxHistoryLength?: number;
	debounceMs?: number;
}

/**
 * Pure client-safe coordinator for playback state persistence, remote polling,
 * and 409 conflict reconciliation.
 *
 * It decouples session synchronization and write serialization from browser
 * audio playback and reactive UI components.
 */
export class PlaybackSessionCoordinator {
	private readonly originFn: () => PlaybackOrigin;
	get origin(): PlaybackOrigin {
		return this.originFn();
	}
	private readonly fetchFn: typeof fetch;
	private readonly getDeviceIdFn: () => string | null;
	private readonly getCurrentStateFn: SessionCoordinatorOptions['getCurrentState'];
	private readonly onApplyQueueFn: SessionCoordinatorOptions['onApplyQueue'];
	private readonly onApplySessionFn?: SessionCoordinatorOptions['onApplySession'];
	private readonly onStatusChangeFn?: SessionCoordinatorOptions['onStatusChange'];
	private readonly onActiveDeviceChangeFn?: SessionCoordinatorOptions['onActiveDeviceChange'];
	private readonly onHydrateMetadataFn?: SessionCoordinatorOptions['onHydrateMetadata'];
	private readonly onQueueCommandsChangeFn?: SessionCoordinatorOptions['onQueueCommandsChange'];
	private readonly canPersistFn?: () => boolean;
	private readonly maxQueueLength: number;
	private readonly maxHistoryLength: number;
	private readonly debounceMs: number;

	revision = 0;
	status: PlaybackPersistenceStatus = 'saved';
	activeDevice: PlaybackDeviceStatus | null = null;
	queueCommands: QueueCommand[] = [];
	reconciliationBase: SavedPlaybackState | null = null;
	reconciliationAttempts = 0;
	/**
	 * Set when `persistQueueCommands` drops a permanently-inapplicable command
	 * this cycle. `persistPlaybackState` checks it before deciding whether the
	 * snapshot write that follows may report `'saved'` — otherwise that report
	 * would silently overwrite `'rejected'` a moment after it was set, and the
	 * one truthful signal that an edit was discarded would never reach the UI.
	 */
	private queueCommandWasRejected = false;
	private serverErrorRetry: 'persist' | 'refresh' | 'sync' = 'persist';

	persistenceInFlight = false;
	persistenceQueued = false;
	private persistenceTimer: ReturnType<typeof setTimeout> | undefined;

	sessionSyncInFlight = false;
	sessionSyncActive = false;
	sessionSyncFailures = 0;
	private sessionSyncTimer: ReturnType<typeof setTimeout> | undefined;
	private sessionRefreshHandler: (() => void) | undefined;

	playbackClaimPending = false;

	constructor(options: SessionCoordinatorOptions) {
		const rawOrigin = options.origin;
		this.originFn = typeof rawOrigin === 'function' ? rawOrigin : () => rawOrigin;
		this.fetchFn =
			options.fetch ??
			(typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (fetch as typeof fetch));
		this.getDeviceIdFn = options.getDeviceId ?? (() => null);
		this.getCurrentStateFn = options.getCurrentState;
		this.onApplyQueueFn = options.onApplyQueue;
		this.onApplySessionFn = options.onApplySession;
		this.onStatusChangeFn = options.onStatusChange;
		this.onActiveDeviceChangeFn = options.onActiveDeviceChange;
		this.onHydrateMetadataFn = options.onHydrateMetadata;
		this.onQueueCommandsChangeFn = options.onQueueCommandsChange;
		this.canPersistFn = options.canPersist;
		this.maxQueueLength = options.maxQueueLength ?? 100;
		this.maxHistoryLength = options.maxHistoryLength ?? 50;
		this.debounceMs = options.debounceMs ?? 500;
	}

	setStatus(newStatus: PlaybackPersistenceStatus): void {
		if (this.status === newStatus) return;
		this.status = newStatus;
		this.onStatusChangeFn?.(newStatus);
	}

	retryAfterServerError(): void {
		if (this.status !== 'server_error') return;
		if (this.serverErrorRetry === 'refresh') {
			this.setStatus('conflict');
			void this.refreshQueueFromServer();
		} else if (this.serverErrorRetry === 'sync') {
			void this.syncPlaybackState();
		} else {
			this.flushPersistence();
		}
	}

	setActiveDevice(device: PlaybackDeviceStatus | null): void {
		this.activeDevice = device;
		this.onActiveDeviceChangeFn?.(device);
	}

	applyActiveDevice(state: SavedPlaybackState): void {
		this.setActiveDevice(state.activeDevice ?? null);
	}

	restoreQueueCommands(commands: QueueCommand[]): void {
		this.queueCommands = commands.slice();
		this.notifyQueueCommandsChanged();
	}

	private notifyQueueCommandsChanged(): void {
		this.onQueueCommandsChangeFn?.(this.queueCommands);
	}

	recordCommand(command: QueueCommand): void {
		this.queueCommands.push(command);
		this.notifyQueueCommandsChanged();
		this.claimPlaybackControlForIntent();
		this.schedulePersistence();
	}

	recordQueueReplacement(queue: QueueEntry[]): void {
		this.queueCommands = [{ type: 'replace', entries: queue.slice(0, this.maxQueueLength) }];
		this.notifyQueueCommandsChanged();
		this.claimPlaybackControlForIntent();
		this.schedulePersistence();
	}

	schedulePersistence(): void {
		if (this.status === 'conflict' || (this.canPersistFn && !this.canPersistFn())) return;
		this.setStatus('saving');
		if (this.persistenceTimer) clearTimeout(this.persistenceTimer);
		this.persistenceTimer = setTimeout(() => {
			this.persistenceTimer = undefined;
			void this.persistPlaybackState();
		}, this.debounceMs);
	}

	cancelPendingPersistence(): void {
		if (this.persistenceTimer) {
			clearTimeout(this.persistenceTimer);
			this.persistenceTimer = undefined;
		}
	}

	/** Start an immediate, best-effort save at navigation and page-lifecycle boundaries. */
	flushPersistence(): void {
		if (this.persistenceTimer) {
			clearTimeout(this.persistenceTimer);
			this.persistenceTimer = undefined;
		}
		if (this.canPersistFn && !this.canPersistFn()) return;
		void this.persistPlaybackState();
	}

	snapshotPlaybackState(): PlaybackPersistenceSnapshot {
		const current = this.getCurrentStateFn();
		const base = this.reconciliationBase;
		return {
			currentTrack: base?.currentTrack ?? current.currentTrack,
			queue: current.queue.slice(0, this.maxQueueLength),
			history: (base?.history ?? current.history).slice(-this.maxHistoryLength),
			currentTime: Math.max(0, Math.floor(base?.currentTime ?? current.currentTime)),
			revision: this.revision,
			origin: this.origin,
			queueCommands: this.queueCommands.slice()
		};
	}

	private queueOperationId(command: QueueCommand): string {
		if (!command.operationId) {
			const uuid =
				typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: Math.random().toString(36).slice(2);
			command.operationId = `operation_${uuid}`;
			this.notifyQueueCommandsChanged();
		}
		return command.operationId;
	}

	private queueIntentPayload(command: QueueCommand): Record<string, unknown> {
		switch (command.type) {
			case 'append':
				return { type: 'queue.append', entries: command.entries };
			case 'prepend':
				return { type: 'queue.prepend', entry: command.entry };
			case 'remove':
				return { type: 'queue.remove', entryId: command.entryId };
			case 'move':
				return {
					type: 'queue.move',
					entryId: command.entryId,
					...(command.beforeEntryId ? { beforeEntryId: command.beforeEntryId } : {}),
					...(command.afterEntryId ? { afterEntryId: command.afterEntryId } : {})
				};
			case 'clear':
				return { type: 'queue.clear' };
			case 'replace':
				return { type: 'queue.replace', entries: command.entries };
		}
	}

	/**
	 * Send queue edits as named operations before the resume snapshot. A lost
	 * response can safely be retried with the same operation ID; a stale write
	 * returns the authoritative entry-aware queue for the normal rebase path.
	 */
	async persistQueueCommands(): Promise<boolean> {
		const deviceId = this.getDeviceIdFn();
		this.queueCommandWasRejected = false;
		while (this.queueCommands.length > 0) {
			const command = this.queueCommands[0];
			if (!command) return true;
			const operationId = this.queueOperationId(command);
			const response = await this.fetchFn('/api/playback-state/intents', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					version: 2,
					expectedRevision: this.revision,
					operationId,
					origin: this.origin,
					...(deviceId ? { deviceId } : {}),
					intent: this.queueIntentPayload(command)
				}),
				keepalive: true
			});
			// Checked before the body is interpreted as a `SavedPlaybackState`: a
			// 401's body never is one, so without this it fell into the next branch
			// and was reported identically to a network drop — "check your
			// connection" is actively wrong advice for a session that has ended.
			if (response.status === 401) {
				this.setStatus('unauthenticated');
				return false;
			}
			if (response.status >= 500) {
				this.serverErrorRetry = 'persist';
				this.setStatus('server_error');
				return false;
			}
			const state = (await response.json().catch(() => null)) as SavedPlaybackState | null;
			if (
				!state ||
				!Array.isArray(state.queue) ||
				typeof state.revision !== 'number' ||
				!Number.isSafeInteger(state.revision)
			) {
				this.setStatus('offline');
				return false;
			}

			if (response.status === 409) {
				this.applyActiveDevice(state);
				if (this.reconciliationAttempts >= 1) {
					this.setStatus('conflict');
					return false;
				}
				this.reconciliationBase = state;
				this.revision = state.revision;
				const rebased = rebaseQueue(state.queue, this.queueCommands, this.maxQueueLength);
				this.onApplyQueueFn(rebased);
				this.reconciliationAttempts += 1;
				continue;
			}
			if (response.status === 400 && isSavedPlaybackState(state)) {
				// The server has told us this exact operation can never apply — most
				// often a remove/move naming an entryId another device already
				// removed. That will not change by retrying: entry IDs are randomly
				// minted per creation, so the target of a stale remove/move never
				// comes back. Treating this like `offline` (as a bare `!response.ok`
				// check would) left it retried forever, jamming every command queued
				// behind it. Drop it, take the state the server actually holds as
				// ground truth, and keep draining the rest of the buffer.
				this.revision = state.revision;
				this.applyActiveDevice(state);
				if (this.queueCommands[0]?.operationId === operationId) {
					this.queueCommands.shift();
					this.notifyQueueCommandsChanged();
				}
				const rebased = rebaseQueue(state.queue, this.queueCommands, this.maxQueueLength);
				this.onApplyQueueFn(rebased);
				this.reconciliationBase = null;
				this.reconciliationAttempts = 0;
				this.queueCommandWasRejected = true;
				this.setStatus('rejected');
				continue;
			}
			if (!response.ok) {
				this.setStatus('offline');
				return false;
			}

			this.revision = state.revision;
			this.applyActiveDevice(state);
			if (this.queueCommands[0]?.operationId === operationId) {
				this.queueCommands.shift();
				this.notifyQueueCommandsChanged();
			}
			this.reconciliationBase = null;
			this.reconciliationAttempts = 0;
		}
		return true;
	}

	async persistPlaybackState(): Promise<void> {
		if (this.canPersistFn && !this.canPersistFn()) return;
		if (this.persistenceInFlight) {
			this.persistenceQueued = true;
			return;
		}

		this.persistenceInFlight = true;
		try {
			if (this.queueCommands.length > 0 && !(await this.persistQueueCommands())) return;
			const snapshot = this.snapshotPlaybackState();
			const deviceId = this.getDeviceIdFn();
			const response = await this.fetchFn('/api/playback-state', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					...snapshot,
					...(deviceId ? { deviceId } : {})
				}),
				keepalive: true
			});
			if (response.status === 401) {
				this.setStatus('unauthenticated');
				return;
			}
			if (response.status >= 500) {
				this.serverErrorRetry = 'persist';
				this.setStatus('server_error');
				return;
			}
			const state = (await response.json().catch(() => null)) as SavedPlaybackState | null;
			if (response.status === 409) {
				if (
					!state ||
					!Array.isArray(state.queue) ||
					typeof state.revision !== 'number' ||
					!Number.isSafeInteger(state.revision) ||
					this.reconciliationAttempts >= 1
				) {
					this.persistenceQueued = false;
					this.setStatus('conflict');
					return;
				}

				// Preserve the currently audible track in this tab. Only its deliberate
				// queue commands are rebased onto the authoritative server queue.
				this.reconciliationBase = state;
				this.revision = state.revision;
				this.applyActiveDevice(state);
				const rebased = rebaseQueue(state.queue, this.queueCommands, this.maxQueueLength);
				this.onApplyQueueFn(rebased);
				this.reconciliationAttempts += 1;
				this.persistenceQueued = true;
				this.setStatus('saving');
				return;
			}
			if (
				!response.ok ||
				typeof state?.revision !== 'number' ||
				!Number.isSafeInteger(state.revision)
			) {
				this.setStatus('offline');
				return;
			}

			this.revision = state.revision;
			this.applyActiveDevice(state);
			this.queueCommands.splice(0, snapshot.queueCommands.length);
			this.notifyQueueCommandsChanged();
			this.reconciliationBase = null;
			this.reconciliationAttempts = 0;
			// A dropped command earlier in this cycle still needs to reach the
			// owner; a `'saved'` here — true of the snapshot write in isolation —
			// would silently erase that signal a moment after it appeared.
			this.setStatus(this.queueCommandWasRejected ? 'rejected' : 'saved');
		} catch {
			this.setStatus('offline');
		} finally {
			this.persistenceInFlight = false;
			if (this.persistenceQueued && this.status !== 'conflict') {
				this.persistenceQueued = false;
				void this.persistPlaybackState();
			}
		}
	}

	async refreshQueueFromServer(): Promise<void> {
		if (this.status !== 'conflict') return;
		this.setStatus('saving');

		try {
			const deviceId = this.getDeviceIdFn();
			const response = await this.fetchFn('/api/playback-state', {
				headers: {
					accept: 'application/json',
					...(deviceId ? { 'x-halflight-playback-device': deviceId } : {})
				},
				cache: 'no-store'
			});
			if (response.status >= 500) {
				this.serverErrorRetry = 'refresh';
				this.setStatus('server_error');
				return;
			}
			const state = (await response.json().catch(() => null)) as SavedPlaybackState | null;
			if (response.status === 401) {
				this.setStatus('unauthenticated');
				return;
			}
			if (
				!response.ok ||
				!state ||
				!Array.isArray(state.queue) ||
				!Array.isArray(state.history) ||
				typeof state.currentTime !== 'number' ||
				typeof state.revision !== 'number' ||
				!Number.isSafeInteger(state.revision)
			) {
				this.setStatus('offline');
				return;
			}

			this.reconciliationBase = state;
			this.revision = state.revision;
			this.applyActiveDevice(state);
			const rebased = rebaseQueue(state.queue, this.queueCommands, this.maxQueueLength);
			this.onApplyQueueFn(rebased);
			this.reconciliationAttempts = 0;

			if (this.queueCommands.length === 0) {
				this.reconciliationBase = null;
				this.setStatus('saved');
				return;
			}

			await this.persistPlaybackState();
		} catch {
			this.setStatus('offline');
		}
	}

	async syncPlaybackState(): Promise<void> {
		if (this.sessionSyncInFlight || this.persistenceInFlight) return;
		this.sessionSyncInFlight = true;

		try {
			const deviceId = this.getDeviceIdFn();
			const response = await this.fetchFn('/api/playback-state', {
				headers: {
					accept: 'application/json',
					...(deviceId ? { 'x-halflight-playback-device': deviceId } : {})
				},
				cache: 'no-store'
			});
			if (response.status >= 500) {
				this.sessionSyncFailures += 1;
				this.serverErrorRetry = 'sync';
				this.setStatus('server_error');
				return;
			}
			const state = (await response.json().catch(() => null)) as unknown;
			// The background poll's failure path previously changed nothing the UI
			// could see — a 401 here (the session has ended, in this tab or another)
			// left the owner staring at a queue that would never sync again, with
			// no indication why. `sessionSyncFailures` still backs off the retry
			// interval the same as any other failure; it does not retry faster or
			// slower for this one, only visibly.
			if (response.status === 401) {
				this.sessionSyncFailures += 1;
				this.setStatus('unauthenticated');
				return;
			}
			if (!response.ok || !isSavedPlaybackState(state)) {
				this.sessionSyncFailures += 1;
				return;
			}

			this.sessionSyncFailures = 0;
			this.applyActiveDevice(state);
			if (state.revision < this.revision) return;

			if (this.queueCommands.length > 0) {
				if (state.revision === this.revision) return;
				this.reconciliationBase = state;
				this.revision = state.revision;
				const rebased = rebaseQueue(state.queue, this.queueCommands, this.maxQueueLength);
				this.onApplyQueueFn(rebased);
				this.reconciliationAttempts = 0;
				this.onHydrateMetadataFn?.(rebased);
				this.schedulePersistence();
				return;
			}

			if (state.revision === this.revision) {
				if (
					!this.persistenceInFlight &&
					(this.status === 'offline' ||
						this.status === 'server_error' ||
						this.status === 'unauthenticated')
				) {
					this.setStatus('saved');
				}
				return;
			}

			this.revision = state.revision;
			const remoteQueue = state.queue.slice(0, this.maxQueueLength);
			this.onApplyQueueFn(remoteQueue);
			this.onHydrateMetadataFn?.(remoteQueue);

			const current = this.getCurrentStateFn();
			if (!current.isPlaying && !current.hasLocalMedia) {
				this.onApplySessionFn?.(state);
			}

			if (
				!this.persistenceInFlight &&
				(this.status === 'offline' ||
					this.status === 'server_error' ||
					this.status === 'unauthenticated')
			) {
				this.setStatus('saved');
			}
		} catch {
			this.sessionSyncFailures += 1;
		} finally {
			this.sessionSyncInFlight = false;
		}
	}

	startSessionSync(): void {
		if (typeof window === 'undefined' || this.sessionSyncActive) return;
		this.sessionSyncActive = true;

		const refreshWhenVisible = () => {
			if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
			void this.syncPlaybackState().finally(() => this.scheduleSessionSync());
		};
		this.sessionRefreshHandler = refreshWhenVisible;

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', refreshWhenVisible);
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('focus', refreshWhenVisible);
			window.addEventListener('online', refreshWhenVisible);
		}
		refreshWhenVisible();
	}

	stopSessionSync(): void {
		this.sessionSyncActive = false;
		if (this.sessionSyncTimer) {
			clearTimeout(this.sessionSyncTimer);
			this.sessionSyncTimer = undefined;
		}
		if (this.sessionRefreshHandler) {
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', this.sessionRefreshHandler);
			}
			if (typeof window !== 'undefined') {
				window.removeEventListener('focus', this.sessionRefreshHandler);
				window.removeEventListener('online', this.sessionRefreshHandler);
			}
			this.sessionRefreshHandler = undefined;
		}
	}

	private scheduleSessionSync(): void {
		if (!this.sessionSyncActive) return;
		if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
		if (this.sessionSyncTimer) clearTimeout(this.sessionSyncTimer);
		const delay = Math.min(30_000, 2_000 * 2 ** this.sessionSyncFailures);
		this.sessionSyncTimer = setTimeout(() => {
			void this.syncPlaybackState().finally(() => this.scheduleSessionSync());
		}, delay);
	}

	async takePlaybackControl(): Promise<boolean> {
		const deviceId = this.getDeviceIdFn();
		if (!deviceId) return false;
		if (
			this.activeDevice?.isCurrent &&
			Date.parse(this.activeDevice.expiresAt) - Date.now() > 15_000
		) {
			return true;
		}
		if (this.playbackClaimPending) return false;
		this.playbackClaimPending = true;
		try {
			const response = await this.fetchFn('/api/playback-state/claim', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deviceId, origin: this.origin }),
				keepalive: true
			});
			const state = (await response.json().catch(() => null)) as unknown;
			if (!response.ok || !isSavedPlaybackState(state)) return false;
			this.revision = Math.max(this.revision, state.revision);
			this.applyActiveDevice(state);
			return state.activeDevice?.isCurrent === true;
		} catch {
			return false;
		} finally {
			this.playbackClaimPending = false;
		}
	}

	private claimPlaybackControlForIntent(): void {
		if (!this.activeDevice?.isCurrent && !this.playbackClaimPending) {
			void this.takePlaybackControl();
		}
	}
}
