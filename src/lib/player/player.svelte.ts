import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { TrackSummary } from '#lib/tidal/models.js';
import { trackArtworkUrl } from '#lib/tidal/artwork';
import { qualityTier, type QualityTier } from '#lib/format';
import { AudioEngine, replayGainToLinear } from 'bragi-audio/player';
import { assessPlayback, type PlaybackAssessment } from './playback-assessment.js';
import {
	setupMediaSessionHandlers,
	updateMediaMetadata,
	updatePlaybackState,
	updatePositionState
} from './media-session.js';
import { rebaseQueue, type QueueCommand } from './playback-reconciliation.js';
import {
	createQueueEntries,
	createQueueEntry,
	isQueueEntryId,
	toDisplayTrack,
	type QueueEntry
} from './queue-entry.js';
import { streamLoader, streamPreloader, type PreloadedStreamData } from './stream-preloader.js';
import {
	PlaybackSessionCoordinator,
	isTrackSummary,
	type PlaybackDeviceStatus,
	type PlaybackOrigin,
	type PlaybackPersistenceSnapshot,
	type PlaybackPersistenceStatus,
	type SavedPlaybackState
} from './session-coordinator.js';

export type { PlaybackDeviceStatus, PlaybackOrigin, PlaybackPersistenceStatus, SavedPlaybackState };

export type DockMode = 'docked' | 'floating';
export type RepeatMode = 'off' | 'all' | 'one';
export type PlayerPanel = 'queue' | 'lyrics' | 'source';

interface PlayerPrefs {
	dockMode: DockMode;
	shuffle: boolean;
	repeatMode: RepeatMode;
	floatingPos: { x: number; y: number };
	panel: PlayerPanel;
	volume?: number;
	isHeadroomEnabled?: boolean;
}

const isBrowser = typeof window !== 'undefined';
const MAX_QUEUE_LENGTH = 100;
const MAX_HISTORY_LENGTH = 50;
const PREFS_KEY = 'syn:player:prefs';
const PLAYBACK_DEVICE_KEY = 'syn:player:device-id';
/**
 * Optimistic, instant-paint mirror of the server-authoritative session plus a
 * durable journal of local queue operations. The snapshot is always replaced
 * by the server; only unacknowledged operations are rebased onto it.
 */
const QUEUE_CACHE_KEY = 'syn:player:queue-cache';
const QUEUE_CACHE_VERSION = 2;
/** Bounded retry for a transient metadata-hydration failure (a dropped
 *  connection, an upstream blip) — a real 404 is never retried. */
const MAX_METADATA_ATTEMPTS = 3;
const METADATA_RETRY_BASE_MS = 1500;
/** Restore only the next handful of unresolved entries; a 100-track legacy
 * queue must not turn route load into a catalogue-wide metadata sweep. */
const MAX_INITIAL_METADATA_HYDRATION = 8;

function shuffled<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/** A prior session may predate the display model, or contain bare linkages. */
function needsTrackMetadata(track: TrackSummary): boolean {
	return (
		track.title === track.id ||
		track.artists.length === 0 ||
		track.artists.some((artist) => Boolean(artist.id) && artist.name === artist.id) ||
		!track.album ||
		track.album.title === track.album.id
	);
}

function isCachedQueueEntry(value: unknown): value is QueueEntry {
	return isTrackSummary(value) && isQueueEntryId((value as QueueEntry).entryId);
}

/** Validate the locally stored intent journal before it can reach the server. */
function isCachedQueueCommand(value: unknown): value is QueueCommand {
	if (!value || typeof value !== 'object') return false;
	const command = value as Record<string, unknown>;
	if (command.operationId !== undefined && !isQueueEntryId(command.operationId)) return false;

	switch (command.type) {
		case 'append':
		case 'replace':
			return Array.isArray(command.entries) && command.entries.every(isCachedQueueEntry);
		case 'prepend':
			return isCachedQueueEntry(command.entry);
		case 'remove':
			return isQueueEntryId(command.entryId);
		case 'move':
			return (
				isQueueEntryId(command.entryId) &&
				(command.beforeEntryId === undefined || isQueueEntryId(command.beforeEntryId)) &&
				(command.afterEntryId === undefined || isQueueEntryId(command.afterEntryId))
			);
		case 'clear':
			return true;
		default:
			return false;
	}
}

export class PlayerState {
	currentTrack = $state<TrackSummary | null>(null);
	/** Each queued occurrence has its own stable identity, including duplicate tracks. */
	queue = $state<QueueEntry[]>([]);
	history = $state<TrackSummary[]>([]);
	isExpanded = $state(false);
	isCoverExpanded = $state(false);

	/** Which panel the expanded player shows. */
	panel = $state<PlayerPanel>('queue');
	/** `docked` = pinned dock/sheet; `floating` = draggable window (desktop only). */
	dockMode = $state<DockMode>('docked');
	floatingPos = $state<{ x: number; y: number }>({ x: 24, y: 24 });
	shuffle = $state(false);
	repeatMode = $state<RepeatMode>('off');
	/** Which site this browser tab is acting as, for session-write attribution. */
	origin = $state<PlaybackOrigin>('listening-room');
	/** Whether the current in-memory session has reached the authoritative server state. */
	persistenceStatus = $state<PlaybackPersistenceStatus>('saved');
	localQueueSaved = $state(true);
	/** Server-projected active playback lease; it contains no device identifier. */
	activeDevice = $state<PlaybackDeviceStatus | null>(null);
	playbackClaimPending = $state(false);
	isPlaybackActiveHere = $derived(Boolean(this.activeDevice?.isCurrent));
	isPlaybackActiveElsewhere = $derived(Boolean(this.activeDevice && !this.activeDevice.isCurrent));

	// Audio playback engine states
	isPlaying = $state(false);
	isLoading = $state(false);
	currentTime = $state(0);
	/**
	 * Where the scrub thumb sits mid-drag, or `null` when not scrubbing. Held
	 * separately from {@link currentTime} so a drag moves the thumb without
	 * touching the `<audio>` element: every `currentTime` write can provoke a
	 * fresh Range request, and a continuous drag would otherwise emit one per
	 * step. The element is moved once, on release, by {@link commitScrub}.
	 */
	scrubPosition = $state<number | null>(null);
	/** The position the UI should render — the drag thumb wins while scrubbing. */
	displayTime = $derived(this.scrubPosition ?? this.currentTime);
	duration = $state(0);
	volume = $state(1);
	isMuted = $state(false);
	isHeadroomEnabled = $state(true);
	maxVolume = $derived(this.isHeadroomEnabled ? 1.25 : 1);
	volumePercent = $derived(Math.round(this.volume * 100));
	bufferedPercent = $state(0);
	isBuffering = $state(false);
	streamUrl = $state<string | null>(null);
	playbackMode = $state<'direct' | 'embed'>('direct');
	audioQuality = $state<string | null>(null);
	requestedQuality = $state<string | null>(null);
	codecs = $state<string | null>(null);
	fileExtension = $state<string | null>(null);
	bitDepth = $state<number | null>(null);
	sampleRate = $state<number | null>(null);
	trackReplayGain = $state<number | null>(null);
	isNormalizationEnabled = $state(true);
	requiresFullAuth = $state(false);
	/** `true` once the `<audio>` element has reported real media metadata. */
	hasMediaMetadata = $state(false);
	/** Diagnostic for the last failed direct-stream attempt (e.g. `not_linked`). */
	playbackReason = $state<string | null>(null);

	// Synchronized Lyrics state
	lyrics = $state<string | null>(null);
	lyricsCues = $state<Array<{ time: number; text: string }>>([]);
	isLyricsLoading = $state(false);
	isLyricsOpen = $derived(this.isExpanded && this.panel === 'lyrics');

	private readonly engine = new AudioEngine({
		onTimeUpdate: (currentTime) => this.onTimeUpdate(currentTime),
		onDuration: (duration) => {
			this.duration = duration;
			this.hasMediaMetadata = true;
			this.updateBuffer();
		},
		onProgress: () => this.updateBuffer(),
		onWaiting: () => {
			this.isBuffering = true;
		},
		onPlaying: () => {
			this.isBuffering = false;
			this.isPlaying = true;
			updatePlaybackState(true);
		},
		onPlay: () => {
			this.isPlaying = true;
			updatePlaybackState(true);
			this.reportNowPlaying();
		},
		onPause: () => {
			this.isPlaying = false;
			updatePlaybackState(false);
		},
		onEnded: () => {
			this.next(true);
		},
		onError: () => {
			// Fall back to embed if direct stream encounters an error
			this.playbackMode = 'embed';
			this.isPlaying = false;
			this.isLoading = false;
			this.isBuffering = false;
			updatePlaybackState(false);
		},
		onWake: () => {
			// Re-sync the lock-screen controls the OS may have dropped while hidden.
			if (this.currentTrack) {
				updateMediaMetadata(this.currentTrack);
				updatePlaybackState(this.isPlaying);
				updatePositionState({ duration: this.duration, position: this.currentTime });
			}
		}
	});
	/** Invalidates stream work started for a track that is no longer current. */
	private streamLoadGeneration = 0;
	private streamLoadAbort: AbortController | null = null;
	/** A local player adjustment must survive shell data hydration. */
	private hasLocalVolumePreference = false;
	private hasRestoredPlaybackState = false;
	/** True while `currentTrack`/`queue`/`history` reflect only the optimistic
	 *  local cache, so the real restore below knows it is safe to overwrite
	 *  them rather than mistaking the seed for genuine pre-restore user activity. */
	private hasHydratedFromLocalCache = false;
	private coordinator: PlaybackSessionCoordinator;

	get playbackStateRevision(): number {
		return this.coordinator.revision;
	}
	set playbackStateRevision(value: number) {
		this.coordinator.revision = value;
	}
	get queueCommands(): QueueCommand[] {
		return this.coordinator.queueCommands;
	}
	set queueCommands(commands: QueueCommand[]) {
		this.coordinator.restoreQueueCommands(commands);
	}
	get reconciliationBase(): SavedPlaybackState | null {
		return this.coordinator.reconciliationBase;
	}
	set reconciliationBase(base: SavedPlaybackState | null) {
		this.coordinator.reconciliationBase = base;
	}
	get reconciliationAttempts(): number {
		return this.coordinator.reconciliationAttempts;
	}
	set reconciliationAttempts(attempts: number) {
		this.coordinator.reconciliationAttempts = attempts;
	}
	get sessionSyncInFlight(): boolean {
		return this.coordinator.sessionSyncInFlight;
	}
	get sessionSyncActive(): boolean {
		return this.coordinator.sessionSyncActive;
	}
	get sessionSyncFailures(): number {
		return this.coordinator.sessionSyncFailures;
	}
	get persistenceInFlight(): boolean {
		return this.coordinator.persistenceInFlight;
	}
	get persistenceQueued(): boolean {
		return this.coordinator.persistenceQueued;
	}
	private lastPersistedPosition = 0;
	private trackStartedAt = 0;
	private lastObservedPlaybackTime = 0;
	private listenedSeconds = 0;
	private reportedNowPlaying = false;
	private scrobbledCurrentTrack = false;
	private metadataCache = new SvelteMap<string, TrackSummary>();
	private metadataRequests = new SvelteMap<string, Promise<void>>();
	/** Attempts spent on a transient failure; absent/0 means "not yet tried". */
	private metadataAttempts = new SvelteMap<string, number>();
	/** A confirmed 404 — retrying can only waste a request the track will never satisfy. */
	private metadataUnavailable = new SvelteSet<string>();
	private deviceId: string | null = null;
	private persistenceLifecycleInstalled = false;

	constructor() {
		this.coordinator = new PlaybackSessionCoordinator({
			origin: () => this.origin,
			getDeviceId: () => this.getDeviceId(),
			getCurrentState: () => ({
				currentTrack: this.currentTrack,
				queue: this.queue,
				history: this.history,
				currentTime: this.currentTime,
				isPlaying: this.isPlaying,
				hasLocalMedia: Boolean(this.streamUrl || this.engine.currentSrc)
			}),
			onApplyQueue: (queue) => {
				this.queue = queue;
				this.writeLocalQueueCache();
			},
			onApplySession: (state) => {
				this.currentTrack = state.currentTrack;
				this.history = state.history.slice(-MAX_HISTORY_LENGTH);
				this.currentTime = Math.max(0, Math.floor(state.currentTime));
				this.duration = state.currentTrack?.duration ?? 0;
				if (this.currentTrack) void this.resolveCover(this.currentTrack);
				this.hydrateTrackMetadata(
					[...(this.currentTrack ? [this.currentTrack] : []), ...this.history],
					MAX_INITIAL_METADATA_HYDRATION
				);
			},
			onStatusChange: (status) => {
				this.persistenceStatus = status;
			},
			onActiveDeviceChange: (device) => {
				this.activeDevice = device;
			},
			onHydrateMetadata: (tracks) => {
				this.hydrateTrackMetadata(tracks);
			},
			onQueueCommandsChange: () => {
				this.writeLocalQueueCache();
			},
			canPersist: () => !isBrowser || this.hasRestoredPlaybackState,
			maxQueueLength: MAX_QUEUE_LENGTH,
			maxHistoryLength: MAX_HISTORY_LENGTH,
			debounceMs: 500
		});

		if (isBrowser) {
			this.loadLocalQueueCache();
			this.loadPrefs();
			this.engine.init();
			this.setupMediaSession();
		}
	}

	private installPersistenceLifecycle(): void {
		if (this.persistenceLifecycleInstalled) return;
		this.persistenceLifecycleInstalled = true;
		const flush = () => this.flushPersistence();
		window.addEventListener('pagehide', flush);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') flush();
		});
	}

	private setupMediaSession(): void {
		setupMediaSessionHandlers({
			onPlay: () => this.resumePlayback(),
			onPause: () => this.pausePlayback(),
			onPrevious: () => this.previous(),
			onNext: () => this.next(),
			onSeekBackward: (sec) => this.seekBy(-sec),
			onSeekForward: (sec) => this.seekBy(sec),
			onSeekTo: (sec) => this.seek(sec),
			onStop: () => this.close()
		});
	}

	private getDeviceId(): string | null {
		if (!isBrowser) return null;
		if (this.deviceId) return this.deviceId;
		try {
			const existing = localStorage.getItem(PLAYBACK_DEVICE_KEY);
			if (/^device_[a-zA-Z0-9_-]{9,}$/.test(existing ?? '')) {
				this.deviceId = existing;
				return existing;
			}
			const identifier = `device_${crypto.randomUUID().replaceAll('-', '_')}`;
			localStorage.setItem(PLAYBACK_DEVICE_KEY, identifier);
			this.deviceId = identifier;
			return identifier;
		} catch {
			// A browser that disallows local storage keeps playback local. It can
			// still play, but cannot safely assert cross-device ownership.
			return null;
		}
	}

	private applyActiveDevice(state: SavedPlaybackState): void {
		this.activeDevice = state.activeDevice ?? null;
		this.coordinator.applyActiveDevice(state);
	}

	/**
	 * Claim this browser only after a deliberate playback action. The network
	 * round trip is intentionally not awaited by transport controls: waiting
	 * would lose the browser's user-activation gesture and make playback feel
	 * slower. The authoritative server response still decides the resume owner.
	 */
	async takePlaybackControl(): Promise<boolean> {
		const result = await this.coordinator.takePlaybackControl();
		this.activeDevice = this.coordinator.activeDevice;
		return result;
	}

	/** Start the current track locally while deliberately taking shared control. */
	playHere(): void {
		if (!this.currentTrack || this.isLoading || this.playbackClaimPending) return;
		void this.takePlaybackControl();
		if (this.playbackMode === 'embed') {
			this.playbackMode = 'direct';
			this.streamUrl = null;
			this.playbackReason = null;
		}
		this.resumePlayback();
	}

	private claimPlaybackControlForIntent(): void {
		if (!this.isPlaybackActiveHere && !this.coordinator.playbackClaimPending) {
			void this.takePlaybackControl();
		}
	}

	private loadPrefs(): void {
		try {
			const raw = localStorage.getItem(PREFS_KEY);
			if (!raw) return;
			const p = JSON.parse(raw) as Partial<PlayerPrefs>;
			if (p.dockMode === 'docked' || p.dockMode === 'floating') this.dockMode = p.dockMode;
			if (typeof p.shuffle === 'boolean') this.shuffle = p.shuffle;
			if (p.repeatMode === 'off' || p.repeatMode === 'all' || p.repeatMode === 'one') {
				this.repeatMode = p.repeatMode;
			}
			if (p.panel === 'queue' || p.panel === 'lyrics' || p.panel === 'source') this.panel = p.panel;
			if (
				p.floatingPos &&
				typeof p.floatingPos.x === 'number' &&
				typeof p.floatingPos.y === 'number'
			) {
				this.floatingPos = p.floatingPos;
			}
			if (typeof p.isHeadroomEnabled === 'boolean') {
				this.isHeadroomEnabled = p.isHeadroomEnabled;
			}
			if (typeof p.volume === 'number' && !isNaN(p.volume)) {
				const max = this.isHeadroomEnabled ? 1.25 : 1;
				this.volume = Math.max(0, Math.min(max, p.volume));
				this.isMuted = this.volume === 0;
				this.hasLocalVolumePreference = true;
			}
		} catch {
			// Corrupt prefs are not worth surfacing.
		}
	}

	private savePrefs(): void {
		if (!isBrowser) return;
		try {
			const prefs: PlayerPrefs = {
				dockMode: this.dockMode,
				shuffle: this.shuffle,
				repeatMode: this.repeatMode,
				floatingPos: this.floatingPos,
				panel: this.panel,
				volume: this.volume,
				isHeadroomEnabled: this.isHeadroomEnabled
			};
			localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
		} catch {
			// Storage may be unavailable (private mode); prefs are a convenience.
		}
	}

	/**
	 * Optimistically paint the last-known queue from localStorage before the
	 * server-authoritative snapshot arrives. Every field is re-validated with
	 * the same shape checks the server itself uses (`isTrackSummary`,
	 * `isQueueEntryId`) — this is untrusted data as far as the app is
	 * concerned, just like anything else read back out of browser storage.
	 * `restorePlaybackState` supersedes the snapshot, then rebases any durable
	 * unsent queue operations onto the authoritative queue.
	 */
	private loadLocalQueueCache(): void {
		try {
			const raw = localStorage.getItem(QUEUE_CACHE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				version?: number;
				currentTrack?: unknown;
				queue?: unknown;
				history?: unknown;
				currentTime?: unknown;
				queueCommands?: unknown;
			};
			if (parsed.version !== 1 && parsed.version !== QUEUE_CACHE_VERSION) return;

			const currentTrack = isTrackSummary(parsed.currentTrack) ? parsed.currentTrack : null;
			const queue = Array.isArray(parsed.queue)
				? parsed.queue
						.filter(
							(entry): entry is QueueEntry =>
								isTrackSummary(entry) && isQueueEntryId((entry as QueueEntry).entryId)
						)
						.slice(0, MAX_QUEUE_LENGTH)
				: [];
			const history = Array.isArray(parsed.history)
				? parsed.history.filter(isTrackSummary).slice(-MAX_HISTORY_LENGTH)
				: [];
			const queueCommands = Array.isArray(parsed.queueCommands)
				? parsed.queueCommands.filter(isCachedQueueCommand)
				: [];
			if (!currentTrack && queue.length === 0 && history.length === 0 && queueCommands.length === 0)
				return;

			this.currentTrack = currentTrack;
			this.queue = queue;
			this.history = history;
			this.coordinator.restoreQueueCommands(queueCommands);
			if (typeof parsed.currentTime === 'number' && Number.isFinite(parsed.currentTime)) {
				this.currentTime = Math.max(0, Math.floor(parsed.currentTime));
				this.duration = currentTrack?.duration ?? 0;
			}
			this.hasHydratedFromLocalCache = true;
		} catch {
			// A corrupt or unavailable cache just skips the optimistic paint —
			// the real server restore still runs normally right after.
		}
	}

	/** Mirror the current queue state for the next page load's instant paint. */
	private writeLocalQueueCache(): void {
		if (!isBrowser) return;
		try {
			if (
				!this.currentTrack &&
				this.queue.length === 0 &&
				this.history.length === 0 &&
				this.queueCommands.length === 0
			) {
				localStorage.removeItem(QUEUE_CACHE_KEY);
				this.localQueueSaved = true;
				return;
			}
			localStorage.setItem(
				QUEUE_CACHE_KEY,
				JSON.stringify({
					version: QUEUE_CACHE_VERSION,
					currentTrack: this.currentTrack,
					queue: this.queue,
					history: this.history,
					currentTime: this.currentTime,
					queueCommands: this.queueCommands
				})
			);
			this.localQueueSaved = true;
		} catch {
			this.localQueueSaved = false;
			// Server persistence continues even if the browser rejects this copy.
		}
	}

	private updateBuffer(): void {
		const percent = this.engine.bufferedPercent();
		if (percent !== null) this.bufferedPercent = percent;
	}

	/**
	 * Mirror the `<audio>` position into reactive state — but never while a new
	 * track is still loading. The outgoing track keeps firing `timeupdate` during
	 * the async metadata fetch, and letting it write `currentTime` makes the next
	 * track inherit the old progress.
	 */
	private onTimeUpdate(currentTime = this.engine.currentTime): void {
		if (this.isLoading) return;
		if (Number.isNaN(currentTime)) return;
		this.currentTime = currentTime;
		this.updateBuffer();
		updatePositionState({ duration: this.duration, position: this.currentTime });

		// Preload next track when entering final 45 seconds
		if (this.duration > 0 && this.duration - this.currentTime <= 45 && this.queue.length > 0) {
			streamPreloader.preload(this.queue[0].id);
		}

		const elapsed = this.currentTime - this.lastObservedPlaybackTime;
		if (elapsed > 0 && elapsed <= 5) this.listenedSeconds += elapsed;
		this.lastObservedPlaybackTime = this.currentTime;
		this.reportScrobbleWhenEligible();
		if (Math.abs(this.currentTime - this.lastPersistedPosition) >= 15) {
			this.lastPersistedPosition = this.currentTime;
			this.schedulePersistence();
		}
	}

	hasNext = $derived(this.queue.length > 0);
	hasPrevious = $derived(this.history.length > 0);
	canGoPrevious = $derived(
		Boolean(this.currentTrack) &&
			!this.isPlaybackActiveElsewhere &&
			(this.hasPrevious || this.currentTime > 3)
	);
	canGoNext = $derived(
		!this.isPlaybackActiveElsewhere &&
			(this.hasNext ||
				(this.repeatMode === 'all' && Boolean(this.currentTrack || this.history.length)))
	);
	canSeek = $derived(
		Boolean(this.currentTrack) &&
			this.playbackMode === 'direct' &&
			!this.isLoading &&
			!this.isPlaybackActiveElsewhere &&
			Number.isFinite(this.duration) &&
			this.duration > 0
	);
	queueCount = $derived(this.queue.length);
	qualityLabel = $derived.by(() => {
		if (!this.audioQuality) return null;
		if (this.audioQuality === 'LOSSLESS' || this.audioQuality === 'HI_RES_LOSSLESS') {
			if (this.bitDepth && this.sampleRate) {
				return `FLAC ${this.bitDepth}bit/${(this.sampleRate / 1000).toFixed(1)}kHz`;
			}
			return 'FLAC LOSSLESS';
		}
		if (this.audioQuality === 'HIGH') {
			return 'AAC 320k';
		}
		if (this.audioQuality === 'LOW') {
			return 'AAC 96k';
		}
		return this.audioQuality;
	});
	/** Fidelity tier of the current stream, for badge colouring. */
	qualityTier = $derived<QualityTier>(qualityTier(this.audioQuality));

	/**
	 * Automatic length + quality self-check for the current stream. Compares the
	 * catalogue duration with the `<audio>` element's real duration and the
	 * requested quality tier with what was delivered — catches previews served
	 * as full tracks and silent quality downgrades.
	 */
	assessment = $derived.by<PlaybackAssessment>(() =>
		assessPlayback({
			expectedSeconds: this.currentTrack?.duration ?? null,
			actualSeconds: this.hasMediaMetadata ? this.duration : null,
			requestedQuality: this.requestedQuality,
			deliveredQuality: this.audioQuality,
			codecs: this.codecs,
			mode: this.playbackMode
		})
	);

	activeLyricIndex = $derived.by(() => {
		if (!this.lyricsCues.length) return -1;
		const time = this.currentTime;
		for (let i = this.lyricsCues.length - 1; i >= 0; i--) {
			if (time >= this.lyricsCues[i].time) return i;
		}
		return 0;
	});

	play(
		track: TrackSummary,
		contextTracks?: TrackSummary[],
		provenance?: string,
		contextIndex?: number
	): void {
		this.claimPlaybackControlForIntent();
		const selectedTrack = this.withProvenance(track, provenance);
		const contextualTracks = contextTracks?.map((candidate) =>
			this.withProvenance(candidate, provenance)
		);

		if (this.currentTrack && this.currentTrack.id !== track.id) {
			this.history.push(this.currentTrack);
		}

		if (contextualTracks && contextualTracks.length > 0) {
			// A playlist can contain the same recording more than once. Use the
			// tapped row's position, then object identity, before falling back to ID.
			const referenceIndex = contextTracks?.indexOf(track) ?? -1;
			const at =
				contextIndex !== undefined &&
				Number.isInteger(contextIndex) &&
				contextualTracks[contextIndex]?.id === track.id
					? contextIndex
					: referenceIndex >= 0
						? referenceIndex
						: contextualTracks.findIndex((candidate) => candidate.id === track.id);
			if (this.shuffle) {
				this.queue = createQueueEntries(
					shuffled(contextualTracks.filter((_, index) => index !== at))
				);
			} else {
				this.queue = createQueueEntries(
					at === -1 ? [...contextualTracks] : contextualTracks.slice(at + 1)
				);
			}
		}

		this.switchToTrack(selectedTrack);
	}

	private withProvenance(track: TrackSummary, provenance?: string): TrackSummary {
		return provenance && !track.provenance ? { ...track, provenance } : track;
	}

	/**
	 * Make `track` the current track and reset every piece of per-track playback
	 * and display state, then kick off the stream, lyrics and artwork loads. The
	 * caller owns queue/history bookkeeping; this owns "everything about the old
	 * track must be gone" so next/previous/playFromQueue can't leave stale
	 * position, quality, codecs, lyrics or embed state on screen.
	 */
	private switchToTrack(track: TrackSummary): void {
		this.streamLoadGeneration += 1;
		this.streamLoadAbort?.abort();
		// A direct track choice is a deliberate session change, so subsequent
		// persistence may use its local current-track/history fields again.
		this.reconciliationBase = null;
		this.recordQueueReplacement();
		this.currentTrack = track;
		this.currentTime = 0;
		// A scrub preview belongs to the track being dragged. If playback advances
		// before the pointer is released, drop it rather than committing the old
		// position against the incoming track.
		this.scrubPosition = null;
		this.trackStartedAt = Date.now();
		this.lastObservedPlaybackTime = 0;
		this.listenedSeconds = 0;
		this.reportedNowPlaying = false;
		this.scrobbledCurrentTrack = false;
		this.duration = track.duration || 0;
		this.hasMediaMetadata = false;
		this.streamUrl = null;
		this.requestedQuality = null;
		this.audioQuality = null;
		this.codecs = null;
		this.fileExtension = null;
		this.bitDepth = null;
		this.sampleRate = null;
		this.trackReplayGain = null;
		this.lyrics = null;
		this.lyricsCues = [];
		this.playbackMode = 'direct';
		this.playbackReason = null;
		this.requiresFullAuth = false;

		this.schedulePersistence();
		updateMediaMetadata(track);
		if (this.queue.length > 0) {
			streamPreloader.preload(this.queue[0].id);
		}

		if (isBrowser) {
			void this.loadAndPlayStream(track.id);
			void this.loadLyrics(track.id);
			void this.resolveCover(track);
			void this.resolveTrackMetadata(track);
		}
	}

	private lastfmPayload():
		| { artist: string; track: string; album?: string; duration?: number; trackNumber?: number }
		| undefined {
		const track = this.currentTrack;
		const artist = track?.artists[0]?.name?.trim();
		if (!track || !artist || !track.title.trim()) return undefined;
		return {
			artist,
			track: track.title,
			...(track.album?.title ? { album: track.album.title } : {}),
			...(track.duration ? { duration: track.duration } : {}),
			...(track.trackNumber ? { trackNumber: track.trackNumber } : {})
		};
	}

	private reportNowPlaying(): void {
		if (!isBrowser || this.reportedNowPlaying || !this.currentTrack) return;
		const payload = this.lastfmPayload();
		if (!payload) return;
		this.reportedNowPlaying = true;
		void fetch('/api/lastfm/now-playing', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		}).catch(() => {
			// Last.fm now-playing is intentionally best-effort.
		});
	}

	private reportScrobbleWhenEligible(): void {
		const track = this.currentTrack;
		if (
			!isBrowser ||
			!track ||
			this.scrobbledCurrentTrack ||
			!track.duration ||
			track.duration <= 30
		) {
			return;
		}
		if (this.listenedSeconds < Math.min(track.duration / 2, 4 * 60)) return;
		const payload = this.lastfmPayload();
		if (!payload) return;
		this.scrobbledCurrentTrack = true;
		void fetch('/api/lastfm/scrobble', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...payload, playedAt: this.trackStartedAt })
		}).catch(() => {
			// The next playback is independent of a temporary Last.fm outage.
		});
	}

	/**
	 * Restore current-track identity from TIDAL when a resumable session only
	 * contains legacy or unresolved identifiers. This is deliberately one track
	 * at a time, does not delay audio, and caches only for the page lifetime.
	 *
	 * A transient failure (a dropped connection, an upstream blip — anything
	 * that isn't a confirmed 404) gets a few bounded, backed-off retries rather
	 * than leaving the stub in place for the rest of the page's life: this is
	 * one-shot only from the caller's point of view, but not from the track's.
	 */
	private async resolveTrackMetadata(track: TrackSummary): Promise<void> {
		if (!isBrowser || !needsTrackMetadata(track)) return;
		if (this.metadataUnavailable.has(track.id)) return;

		const cached = this.metadataCache.get(track.id);
		if (cached) {
			this.applyTrackMetadata(cached);
			return;
		}

		const pending = this.metadataRequests.get(track.id);
		if (pending) return pending;

		const request = (async () => {
			try {
				const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/metadata`).catch(
					() => null
				);

				// A confirmed 404 will never resolve; anything else (no response,
				// 5xx, "not connected") might just be transient.
				if (response?.status === 404) {
					this.metadataUnavailable.add(track.id);
					this.metadataAttempts.delete(track.id);
					return;
				}
				if (!response?.ok) {
					this.scheduleMetadataRetry(track);
					return;
				}

				const body = (await response.json().catch(() => null)) as { track?: unknown } | null;
				if (!isTrackSummary(body?.track) || body.track.id !== track.id) {
					this.scheduleMetadataRetry(track);
					return;
				}

				this.metadataAttempts.delete(track.id);
				this.metadataCache.set(track.id, body.track);
				this.applyTrackMetadata(body.track);
			} finally {
				this.metadataRequests.delete(track.id);
			}
		})();

		this.metadataRequests.set(track.id, request);
		return request;
	}

	private scheduleMetadataRetry(track: TrackSummary): void {
		const attempts = (this.metadataAttempts.get(track.id) ?? 0) + 1;
		this.metadataAttempts.set(track.id, attempts);
		if (attempts >= MAX_METADATA_ATTEMPTS) return;

		setTimeout(() => void this.resolveTrackMetadata(track), METADATA_RETRY_BASE_MS * attempts);
	}

	/**
	 * Give every still-unresolved track another chance right now, rather than
	 * waiting out the backoff — the queue panel calls this on open, since that
	 * is the moment a stale "Track details are unavailable" stub is actually
	 * seen. A confirmed 404 is deliberately left alone: retrying a track that
	 * doesn't exist only spends a request no answer will ever satisfy.
	 */
	retryUnresolvedMetadata(): void {
		if (!isBrowser) return;
		const candidates = [
			...(this.currentTrack ? [this.currentTrack] : []),
			...this.queue,
			...this.history
		].filter((track) => needsTrackMetadata(track) && !this.metadataUnavailable.has(track.id));

		for (const track of candidates) this.metadataAttempts.delete(track.id);
		this.hydrateTrackMetadata(candidates, Number.POSITIVE_INFINITY);
	}

	/**
	 * A saved session can contain several legacy identifier-only entries. Restore
	 * their display data in small batches so the queue and history become useful
	 * without delaying playback or overwhelming the metadata endpoint.
	 */
	private hydrateTrackMetadata(
		tracks: Iterable<TrackSummary>,
		limit = MAX_INITIAL_METADATA_HYDRATION
	): void {
		const unresolved = new SvelteMap<string, TrackSummary>();
		for (const track of tracks) {
			if (needsTrackMetadata(track)) unresolved.set(track.id, track);
		}

		const pending = [...unresolved.values()].slice(0, limit);
		void (async () => {
			for (let start = 0; start < pending.length; start += 4) {
				await Promise.all(
					pending.slice(start, start + 4).map((track) => this.resolveTrackMetadata(track))
				);
			}
		})();
	}

	private applyTrackMetadata(metadata: TrackSummary): void {
		const enrich = <T extends TrackSummary>(candidate: T): T => {
			if (candidate.id !== metadata.id) return candidate;
			return {
				...candidate,
				...metadata,
				...(candidate.provenance ? { provenance: candidate.provenance } : {})
			} as T;
		};

		if (this.currentTrack) this.currentTrack = enrich(this.currentTrack);
		this.queue = this.queue.map((entry) => enrich(entry));
		this.history = this.history.map(enrich);
		this.duration = this.currentTrack?.duration ?? this.duration;
		updateMediaMetadata(this.currentTrack);
		this.schedulePersistence();
	}

	/**
	 * Backfill artwork for a track that came from a list which didn't side-load it
	 * (search results, the resumed queue). Patches every copy of the track in
	 * player state so the mini-bar, large cover and queue row all update.
	 */
	private resolveCover(track: TrackSummary): void {
		if (!isBrowser || track.imageUrl || track.album?.imageUrl || !/^\d+$/.test(track.id)) return;
		const url = trackArtworkUrl(track);
		if (!url) return;

		const patched = (t: TrackSummary): TrackSummary =>
			t.id === track.id && !t.imageUrl ? { ...t, imageUrl: url } : t;
		if (this.currentTrack) this.currentTrack = patched(this.currentTrack);
		this.queue = this.queue.map((entry) =>
			entry.id === track.id && !entry.imageUrl ? { ...entry, imageUrl: url } : entry
		);
		this.history = this.history.map(patched);
	}

	async loadLyrics(trackId: string): Promise<void> {
		this.isLyricsLoading = true;
		try {
			const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/lyrics`).catch(
				() => null
			);
			if (res && res.ok) {
				const data = (await res.json().catch(() => null)) as {
					lyrics?: string;
					cues?: Array<{ time: number; text: string }>;
				} | null;

				if (data) {
					this.lyrics = data.lyrics || null;
					this.lyricsCues = data.cues || [];
				}
			}
		} catch {
			// Lyrics unavailable
		} finally {
			this.isLyricsLoading = false;
		}
	}

	/** Show a panel (expanding the player), or collapse if that panel is already open. */
	openPanel(panel: PlayerPanel): void {
		if (this.isExpanded && this.panel === panel) {
			this.isExpanded = false;
		} else {
			this.selectPanel(panel, false);
		}
		this.savePrefs();
	}

	/** Select a visible detail tab without treating the active tab as a close button. */
	selectPanel(panel: PlayerPanel, save = true): void {
		this.panel = panel;
		this.isExpanded = true;
		if (panel === 'lyrics' && !this.lyrics && this.currentTrack) {
			void this.loadLyrics(this.currentTrack.id);
		}
		if (save) this.savePrefs();
	}

	toggleShuffle(): void {
		this.shuffle = !this.shuffle;
		this.savePrefs();
	}

	cycleRepeat(): void {
		this.repeatMode = this.repeatMode === 'off' ? 'all' : this.repeatMode === 'all' ? 'one' : 'off';
		this.savePrefs();
	}

	toggleDock(): void {
		this.dockMode = this.dockMode === 'docked' ? 'floating' : 'docked';
		if (this.dockMode === 'floating') this.isExpanded = true;
		this.savePrefs();
	}

	setFloatingPos(x: number, y: number): void {
		this.floatingPos = { x, y };
		this.savePrefs();
	}

	/**
	 * Live drag update for the floating window: place its top-left at the pointer
	 * minus the grab offset, clamped so the ~380px window stays fully within the
	 * given viewport (8px inset). Does not persist — call `setFloatingPos` on drop.
	 */
	dragTo(
		clientX: number,
		clientY: number,
		offsetX: number,
		offsetY: number,
		viewportWidth: number,
		viewportHeight: number
	): void {
		const width = 380;
		const height = this.isExpanded ? 460 : 92;
		this.floatingPos = {
			x: Math.min(Math.max(8, clientX - offsetX), viewportWidth - width - 8),
			y: Math.min(Math.max(8, clientY - offsetY), viewportHeight - height - 8)
		};
	}

	toggleNormalization(): void {
		this.isNormalizationEnabled = !this.isNormalizationEnabled;
		this.applyVolume();
	}

	private isMobilePlayback(): boolean {
		if (!isBrowser) return false;
		if (this.origin === 'halflight-now') return true;
		return navigator.maxTouchPoints > 0 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
	}

	private applyVolume(): void {
		let level = this.volume;
		if (this.isNormalizationEnabled && this.trackReplayGain != null) {
			level = Math.max(0, this.volume * replayGainToLinear(this.trackReplayGain));
		}
		// Mobile keeps native <audio> volume: Web Audio gets suspended by iOS on
		// screen lock. Elsewhere the gain stage only carries headroom above 100%.
		this.engine.applyVolume({
			level,
			muted: this.isMuted,
			allowWebAudio: !this.isMobilePlayback() && this.isHeadroomEnabled && level > 1
		});
	}

	private async loadAndPlayStream(trackId: string): Promise<void> {
		this.streamLoadAbort?.abort();
		const abort = new AbortController();
		this.streamLoadAbort = abort;
		const generation = this.streamLoadGeneration;
		const isCurrentLoad = () =>
			generation === this.streamLoadGeneration &&
			this.currentTrack?.id === trackId &&
			!abort.signal.aborted;

		this.engine.init();
		this.engine.resume();
		const startAt = this.currentTime;
		this.isLoading = true;

		// Check lookahead preloaded metadata first for zero-latency start
		const preloaded = streamPreloader.consume(trackId);
		let data: PreloadedStreamData | null = preloaded;

		if (!data) {
			// If not yet preloaded, check if a preload is inflight or fetch directly.
			// Do not pause the audio before we have the next source, to preserve the
			// iOS WebKit background continuation token during queue handover.
			data = await streamPreloader.getOrAwait(trackId);
			if (!isCurrentLoad()) return;
			if (!data) {
				const result = await streamLoader.load(trackId, abort.signal);
				if (!isCurrentLoad()) return;
				if (result.ok) data = result.data;
				else {
					this.requiresFullAuth = result.requiresAuth;
					this.playbackReason = result.reason;
				}
			}
		}

		// A skip or close may have happened while the stream request was pending.
		// Never let the old response replace the new track's source or state.
		if (!isCurrentLoad()) return;

		if (data && this.engine.hasElement) {
			// Store metadata
			this.streamUrl = `/api/tracks/${encodeURIComponent(trackId)}/audio`;
			this.audioQuality = data.audioQuality || data.audioMode || 'HIGH';
			this.requestedQuality = data.requestedQuality ?? null;
			this.codecs = data.codecs || null;
			this.fileExtension = data.fileExtension || null;
			this.bitDepth = data.bitDepth ?? null;
			this.sampleRate = data.sampleRate ?? null;
			this.trackReplayGain = data.trackReplayGain ?? null;
			this.requiresFullAuth = data.requiresFullAuth ?? false;
			this.playbackMode = 'direct';

			// Syn proxies the authenticated CDN response so the browser never sees a
			// provider URL or bearer credential.
			this.engine.load(this.streamUrl, startAt);
			this.applyVolume();
			const started = await this.engine.play();
			if (!isCurrentLoad()) return;
			if (!started) this.playbackMode = 'embed';
			this.isPlaying = !this.engine.paused;
			this.isLoading = false;

			// Immediately preload the next track in queue
			if (this.queue.length > 0) {
				streamPreloader.preload(this.queue[0].id);
			}
			return;
		}

		if (!isCurrentLoad()) return;
		// Direct playback unavailable — hand off to the TIDAL embed player
		this.playbackMode = 'embed';
		this.isPlaying = false;
		this.isLoading = false;
		this.isExpanded = true;
	}

	togglePlayPause(): void {
		if (!this.currentTrack || this.isLoading) return;
		if (this.isPlaying) this.pausePlayback();
		else this.resumePlayback();
	}

	/** Idempotent start for Resume and OS Play; never turns a delayed Play into Pause. */
	resumePlayback(): void {
		if (!this.currentTrack || this.isLoading || this.isPlaying) return;
		this.engine.init();
		this.engine.resume();

		if (this.playbackMode === 'embed') {
			// The TIDAL embed iframe owns its own transport; just make sure it is
			// visible so the viewer can use it.
			this.isExpanded = true;
			return;
		}
		this.claimPlaybackControlForIntent();

		if (this.currentTrack && !this.streamUrl) {
			void this.loadAndPlayStream(this.currentTrack.id);
		} else if (this.engine.hasElement && this.streamUrl) {
			this.isLoading = true;
			const generation = this.streamLoadGeneration;
			void this.engine.play().then((started) => {
				if (generation !== this.streamLoadGeneration) return;
				this.isLoading = false;
				if (started) {
					this.isPlaying = !this.engine.paused;
					return;
				}
				this.playbackMode = 'embed';
				this.isExpanded = true;
			});
		} else {
			this.playbackMode = 'embed';
			this.isPlaying = false;
			this.isExpanded = true;
		}
	}

	/** OS Pause and UI Pause are explicit actions, never a toggle. */
	pausePlayback(): void {
		if (this.playbackMode !== 'direct') return;
		this.streamLoadAbort?.abort();
		this.streamLoadGeneration += 1;
		this.isLoading = false;
		this.engine.pause();
		this.isPlaying = false;
		updatePlaybackState(false);
	}

	/** A deliberate retry keeps the selected track, position, history and queue. */
	retryPlayback(): void {
		if (!this.currentTrack || this.isLoading || this.isPlaybackActiveElsewhere) return;
		this.playbackMode = 'direct';
		this.playbackReason = null;
		this.claimPlaybackControlForIntent();
		void this.loadAndPlayStream(this.currentTrack.id);
	}

	private clampToTrack(seconds: number): number {
		return Math.max(0, Math.min(seconds, this.duration || 9999));
	}

	/**
	 * Move the scrub thumb without moving the audio. Safe to call continuously
	 * from a drag: it touches no element and schedules no persistence. Pair it
	 * with {@link commitScrub} on release.
	 */
	scrubTo(seconds: number): void {
		const target = this.clampToTrack(seconds);
		if (!isNaN(target)) this.scrubPosition = target;
	}

	/** Abandon a drag without moving playback (e.g. `pointercancel`). */
	cancelScrub(): void {
		this.scrubPosition = null;
	}

	/** Apply the pending scrub to the element. No-op when no drag is in flight. */
	commitScrub(): void {
		const target = this.scrubPosition;
		this.scrubPosition = null;
		if (target === null) return;
		this.seek(target);
	}

	seek(seconds: number): void {
		const target = this.clampToTrack(seconds);
		this.currentTime = target;
		this.engine.seek(target);
		this.lastPersistedPosition = target;
		this.schedulePersistence();
	}

	seekBy(seconds: number): void {
		this.seek(this.currentTime + seconds);
	}

	setVolume(vol: number): void {
		const max = this.maxVolume;
		const clamped = Math.max(0, Math.min(vol, max));
		this.volume = Number(clamped.toFixed(2));
		this.isMuted = this.volume === 0;
		this.hasLocalVolumePreference = true;
		this.applyVolume();
		this.savePrefs();
	}

	adjustVolume(delta: number): void {
		this.setVolume(this.volume + delta);
	}

	toggleHeadroom(): void {
		this.isHeadroomEnabled = !this.isHeadroomEnabled;
		if (!this.isHeadroomEnabled && this.volume > 1) {
			this.volume = 1;
		}
		this.applyVolume();
		this.savePrefs();
	}

	/** Apply server defaults without clobbering a locally adjusted player volume. */
	applyStreamingSettings(settings: { volume: number; loudnessNormalization: boolean }): void {
		if (!this.hasLocalVolumePreference) {
			this.volume = Math.max(0, Math.min(this.maxVolume, settings.volume / 100));
			this.isMuted = this.volume === 0;
		}
		this.isNormalizationEnabled = settings.loudnessNormalization;
		this.applyVolume();
	}

	toggleMute(): void {
		this.isMuted = !this.isMuted;
		this.applyVolume();
	}

	toggleCoverExpanded(): void {
		this.isCoverExpanded = !this.isCoverExpanded;
	}

	addToQueue(track: TrackSummary, provenance?: string): void {
		const queuedTrack = createQueueEntry(this.withProvenance(track, provenance));
		this.queue.push(queuedTrack);
		this.coordinator.recordCommand({ type: 'append', entries: [queuedTrack] });
		if (this.queue.length === 1) {
			streamPreloader.preload(queuedTrack.id);
		}
	}

	/** Insert a track directly after the current one without interrupting playback. */
	playNext(track: TrackSummary, provenance?: string): void {
		const queuedTrack = createQueueEntry(this.withProvenance(track, provenance));
		this.queue.unshift(queuedTrack);
		this.coordinator.recordCommand({ type: 'prepend', entry: queuedTrack });
		streamPreloader.preload(queuedTrack.id);
	}

	addMultipleToQueue(tracks: TrackSummary[], provenance?: string): void {
		if (!tracks.length) return;
		const wasEmpty = this.queue.length === 0;
		const entries = createQueueEntries(
			tracks.map((track) => this.withProvenance(track, provenance))
		);
		this.queue.push(...entries);
		this.coordinator.recordCommand({ type: 'append', entries });
		if (wasEmpty) streamPreloader.preload(entries[0].id);
	}

	/** Remove one queue occurrence by its stable entry identity. */
	removeFromQueue(entryId: string): void {
		const index = this.queue.findIndex((entry) => entry.entryId === entryId);
		if (index === -1) return;
		this.queue.splice(index, 1);
		this.coordinator.recordCommand({ type: 'remove', entryId });
	}

	clearQueue(): void {
		if (this.queue.length === 0) return;
		this.queue = [];
		this.coordinator.recordCommand({ type: 'clear' });
	}

	/** Move one queue occurrence up (`-1`) or down (`1`) by stable identity. */
	moveQueueItem(entryId: string, direction: -1 | 1): void {
		const index = this.queue.findIndex((entry) => entry.entryId === entryId);
		const target = index + direction;
		if (index < 0 || index >= this.queue.length || target < 0 || target >= this.queue.length)
			return;
		[this.queue[index], this.queue[target]] = [this.queue[target], this.queue[index]];
		const moved = this.queue[target];
		if (moved) {
			this.coordinator.recordCommand({
				type: 'move',
				entryId: moved.entryId,
				...(direction === -1 && this.queue[target + 1]
					? { beforeEntryId: this.queue[target + 1].entryId }
					: {}),
				...(direction === 1 && this.queue[target - 1]
					? { afterEntryId: this.queue[target - 1].entryId }
					: {})
			});
		}
	}

	/**
	 * Reorder the upcoming queue, updating local state and scheduling
	 * atomic single-write persistence via the session coordinator.
	 */
	reorderQueue(newQueue: QueueEntry[]): void {
		this.queue = [...newQueue];
		this.coordinator.recordQueueReplacement(this.queue);
	}

	/**
	 * Advance playback. Honours repeat (`one` replays, `all` refills the queue
	 * from history once it empties) and shuffle (picks a random queued track).
	 * @param auto `true` when triggered by a track ending, so repeat-one applies.
	 */
	next(auto = false): TrackSummary | null {
		if (!auto) this.claimPlaybackControlForIntent();
		if (auto && this.repeatMode === 'one' && this.currentTrack) {
			this.currentTime = 0;
			if (isBrowser) void this.loadAndPlayStream(this.currentTrack.id);
			return this.currentTrack;
		}

		if (this.queue.length === 0) {
			if (this.repeatMode !== 'all') return null;
			const loop = [...this.history, ...(this.currentTrack ? [this.currentTrack] : [])];
			if (loop.length === 0) return null;
			this.history = [];
			this.queue = createQueueEntries(this.shuffle ? shuffled(loop) : loop);
		}

		if (this.currentTrack) this.history.push(this.currentTrack);
		const index = this.shuffle ? Math.floor(Math.random() * this.queue.length) : 0;
		const [nextEntry] = this.queue.splice(index, 1);
		const nextTrack = toDisplayTrack(nextEntry);
		this.switchToTrack(nextTrack);
		return nextTrack;
	}

	previous(): TrackSummary | null {
		this.claimPlaybackControlForIntent();
		if (this.currentTime > 3) {
			this.seek(0);
			return this.currentTrack;
		}

		if (this.history.length === 0) {
			this.seek(0);
			return null;
		}

		const prevTrack = this.history.pop()!;
		if (this.currentTrack) {
			this.queue.unshift(createQueueEntry(this.currentTrack));
		}
		this.switchToTrack(prevTrack);
		return prevTrack;
	}

	/** Start a specific queued occurrence by its stable entry identity. */
	playFromQueue(entryId: string): void {
		this.claimPlaybackControlForIntent();
		const index = this.queue.findIndex((entry) => entry.entryId === entryId);
		if (index === -1) return;
		if (this.currentTrack) {
			this.history.push(this.currentTrack);
		}
		const [targetEntry] = this.queue.splice(index, 1);
		this.switchToTrack(toDisplayTrack(targetEntry));
	}

	toggleExpanded(): void {
		this.isExpanded = !this.isExpanded;
	}

	close(): void {
		this.streamLoadGeneration += 1;
		this.streamLoadAbort?.abort();
		this.engine.unload();
		this.currentTrack = null;
		this.queue = [];
		this.history = [];
		this.reconciliationBase = null;
		this.recordQueueReplacement();
		this.isExpanded = false;
		this.isPlaying = false;
		this.isLoading = false;
		this.scrubPosition = null;
		this.currentTime = 0;
		this.duration = 0;
		this.bufferedPercent = 0;
		this.isBuffering = false;
		this.streamUrl = null;
		updateMediaMetadata(null);
		updatePlaybackState(false);
		streamPreloader.clear();
		this.schedulePersistence();
	}

	/** Restore a server-saved queue once per browser session without auto-playing it. */
	restorePlaybackState(state: SavedPlaybackState): void {
		// State seeded by `loadLocalQueueCache` is optimistic only, never a
		// reason to skip the authoritative restore — only genuine pre-restore
		// user activity (this flag false, and something already playing/queued)
		// should do that.
		const hasGenuineLocalActivity =
			!this.hasHydratedFromLocalCache &&
			(this.currentTrack !== null || this.queue.length > 0 || this.history.length > 0);
		if (this.hasRestoredPlaybackState || hasGenuineLocalActivity) return;
		this.hasRestoredPlaybackState = true;
		this.hasHydratedFromLocalCache = false;
		this.currentTrack = state.currentTrack;
		this.queue = state.queue.slice(0, MAX_QUEUE_LENGTH);
		this.history = state.history.slice(-MAX_HISTORY_LENGTH);
		this.currentTime = Math.max(0, Math.floor(state.currentTime));
		this.playbackStateRevision = Math.max(0, state.revision ?? 0);
		this.applyActiveDevice(state);
		const pendingQueueCommands = this.queueCommands.slice();
		this.reconciliationBase = null;
		this.reconciliationAttempts = 0;
		this.lastPersistedPosition = this.currentTime;
		this.duration = state.currentTrack?.duration || 0;

		if (pendingQueueCommands.length > 0) {
			this.queue = rebaseQueue(this.queue, pendingQueueCommands, MAX_QUEUE_LENGTH);
			this.schedulePersistence();
		}

		if (this.currentTrack) void this.resolveCover(this.currentTrack);
		this.hydrateTrackMetadata(
			[...(this.currentTrack ? [this.currentTrack] : []), ...this.queue, ...this.history],
			MAX_INITIAL_METADATA_HYDRATION
		);
	}

	/**
	 * Reconcile a second open client with the authoritative session. This is a
	 * display/queue refresh only: it never starts, pauses, seeks, or replaces
	 * audio that is already playing in this browser.
	 */
	async syncPlaybackState(): Promise<void> {
		if (!isBrowser) return;
		return this.coordinator.syncPlaybackState();
	}

	/** Start bounded, visibility-aware session refreshes for an app shell. */
	startSessionSync(): void {
		if (!isBrowser) return;
		this.installPersistenceLifecycle();
		this.coordinator.startSessionSync();
	}

	stopSessionSync(): void {
		this.coordinator.stopSessionSync();
	}

	private recordQueueReplacement(): void {
		this.coordinator.recordQueueReplacement(this.queue);
	}

	private snapshotPlaybackState(): PlaybackPersistenceSnapshot {
		return this.coordinator.snapshotPlaybackState();
	}

	private async persistQueueCommands(): Promise<boolean> {
		return this.coordinator.persistQueueCommands();
	}

	/**
	 * Refresh a queue after the automatic stale-write retry has also conflicted.
	 * The currently audible track remains local; only deliberate queue commands
	 * are replayed over the latest server queue before one new conditional write.
	 */
	async refreshQueueFromServer(): Promise<void> {
		if (!isBrowser) return;
		return this.coordinator.refreshQueueFromServer();
	}

	schedulePersistence(): void {
		this.writeLocalQueueCache();
		this.coordinator.schedulePersistence();
	}

	/** Persist the current queue intent before a route or document lifecycle boundary. */
	flushPersistence(): void {
		this.writeLocalQueueCache();
		this.coordinator.flushPersistence();
	}

	retryPersistence(): void {
		this.coordinator.retryAfterServerError();
	}

	private async persistPlaybackState(): Promise<void> {
		return this.coordinator.persistPlaybackState();
	}
}

export const player = new PlayerState();
