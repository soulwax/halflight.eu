import { SvelteMap } from 'svelte/reactivity';
import type { TrackSummary } from '#lib/tidal/models.js';
import { qualityTier, type QualityTier } from '#lib/format';
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
import { streamPreloader, type PreloadedStreamData } from './stream-preloader.js';

/** Which site persisted a queue/position write — see MASTERPLAN.md's session contract. */
export type PlaybackOrigin = 'listening-room' | 'halflight-now';

export interface SavedPlaybackState {
	currentTrack: TrackSummary | null;
	queue: QueueEntry[];
	history: TrackSummary[];
	currentTime: number;
	revision?: number;
	lastOrigin?: PlaybackOrigin | null;
}

interface PlaybackStateWrite extends SavedPlaybackState {
	revision: number;
	origin: PlaybackOrigin;
}

interface PlaybackPersistenceSnapshot extends PlaybackStateWrite {
	queueCommands: QueueCommand[];
}

export type DockMode = 'docked' | 'floating';
export type RepeatMode = 'off' | 'all' | 'one';
export type PlayerPanel = 'queue' | 'lyrics' | 'source';
export type PlaybackPersistenceStatus = 'saved' | 'saving' | 'offline' | 'conflict';

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

function shuffled<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function isTrackSummary(value: unknown): value is TrackSummary {
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

/** A prior session may predate the display model, or contain bare linkages. */
function needsTrackMetadata(track: TrackSummary): boolean {
	return (
		track.title === track.id ||
		track.artists.length === 0 ||
		track.artists.some((artist) => Boolean(artist.id) && artist.name === artist.id) ||
		!track.album ||
		track.album.title === track.album.id ||
		!track.album.releaseDate
	);
}

/** Keep an untrusted session refresh from replacing the live player with a partial response. */
function isSavedPlaybackState(value: unknown): value is SavedPlaybackState & { revision: number } {
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
		state.revision >= 0
	);
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

	// Audio playback engine states
	isPlaying = $state(false);
	isLoading = $state(false);
	currentTime = $state(0);
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

	private audio: HTMLAudioElement | null = null;
	private audioContext: AudioContext | null = null;
	private mediaSourceNode: MediaElementAudioSourceNode | null = null;
	private gainNode: GainNode | null = null;
	private hasRestoredPlaybackState = false;
	private persistenceTimer: ReturnType<typeof setTimeout> | undefined;
	private persistenceInFlight = false;
	private persistenceQueued = false;
	private playbackStateRevision = 0;
	private queueCommands: QueueCommand[] = [];
	private reconciliationBase: SavedPlaybackState | null = null;
	private reconciliationAttempts = 0;
	private sessionSyncTimer: ReturnType<typeof setTimeout> | undefined;
	private sessionSyncActive = false;
	private sessionSyncInFlight = false;
	private sessionSyncFailures = 0;
	private lastPersistedPosition = 0;
	private trackStartedAt = 0;
	private lastObservedPlaybackTime = 0;
	private listenedSeconds = 0;
	private reportedNowPlaying = false;
	private scrobbledCurrentTrack = false;
	private metadataCache = new SvelteMap<string, TrackSummary>();
	private metadataRequests = new SvelteMap<string, Promise<void>>();

	constructor() {
		if (isBrowser) {
			this.loadPrefs();
			this.initAudio();
			this.setupMediaSession();
		}
	}

	private setupMediaSession(): void {
		setupMediaSessionHandlers({
			onPlay: () => this.togglePlayPause(),
			onPause: () => this.togglePlayPause(),
			onPrevious: () => this.previous(),
			onNext: () => this.next(),
			onSeekBackward: (sec) => this.seekBy(-sec),
			onSeekForward: (sec) => this.seekBy(sec),
			onSeekTo: (sec) => this.seek(sec),
			onStop: () => this.close()
		});
	}

	private ensureAudioGraph(): void {
		if (!isBrowser || !this.audio || this.gainNode) return;
		try {
			const AudioCtx =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AudioCtx) return;
			if (!this.audioContext) {
				this.audioContext = new AudioCtx();
			}
			if (!this.mediaSourceNode) {
				this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audio);
			}
			if (!this.gainNode) {
				this.gainNode = this.audioContext.createGain();
				this.mediaSourceNode.connect(this.gainNode);
				this.gainNode.connect(this.audioContext.destination);
			}
		} catch {
			// Web Audio API initialization is best-effort fallback to standard audio.volume
		}
	}

	private resumeAudioContext(): void {
		if (this.audioContext && this.audioContext.state === 'suspended') {
			void this.audioContext.resume().catch(() => {});
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

	private initAudio(): void {
		if (!isBrowser || typeof Audio === 'undefined') return;
		if (this.audio) return;

		this.audio = new Audio();
		this.audio.preload = 'auto';

		this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());

		const onMeta = () => {
			if (this.audio && !isNaN(this.audio.duration) && this.audio.duration > 0) {
				this.duration = this.audio.duration;
				this.hasMediaMetadata = true;
				this.updateBuffer();
			}
		};
		this.audio.addEventListener('durationchange', onMeta);
		this.audio.addEventListener('loadedmetadata', onMeta);
		this.audio.addEventListener('progress', () => this.updateBuffer());

		this.audio.addEventListener('waiting', () => {
			this.isBuffering = true;
		});

		this.audio.addEventListener('playing', () => {
			this.isBuffering = false;
			this.isPlaying = true;
			updatePlaybackState(true);
		});

		this.audio.addEventListener('play', () => {
			this.isPlaying = true;
			updatePlaybackState(true);
			this.reportNowPlaying();
		});

		this.audio.addEventListener('pause', () => {
			this.isPlaying = false;
			updatePlaybackState(false);
		});

		this.audio.addEventListener('ended', () => {
			this.next(true);
		});

		this.audio.addEventListener('error', () => {
			// Fall back to embed if direct stream encounters an error
			this.playbackMode = 'embed';
			this.isPlaying = false;
			this.isLoading = false;
			this.isBuffering = false;
			updatePlaybackState(false);
		});

		// Auto-reconnect audio context on tab wake or connection restore
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				this.resumeAudioContext();
			}
		});
		window.addEventListener('online', () => {
			this.resumeAudioContext();
		});
	}

	private updateBuffer(): void {
		if (!this.audio || !this.audio.duration || Number.isNaN(this.audio.duration)) return;
		const buffered = this.audio.buffered;
		if (buffered.length === 0) {
			this.bufferedPercent = 0;
			return;
		}
		const current = this.audio.currentTime;
		for (let i = 0; i < buffered.length; i++) {
			if (buffered.start(i) <= current && current <= buffered.end(i)) {
				this.bufferedPercent = Math.min(
					100,
					Math.max(0, (buffered.end(i) / this.audio.duration) * 100)
				);
				return;
			}
		}
		const lastEnd = buffered.end(buffered.length - 1);
		this.bufferedPercent = Math.min(100, Math.max(0, (lastEnd / this.audio.duration) * 100));
	}

	/**
	 * Mirror the `<audio>` position into reactive state — but never while a new
	 * track is still loading. The outgoing track keeps firing `timeupdate` during
	 * the async metadata fetch, and letting it write `currentTime` makes the next
	 * track inherit the old progress.
	 */
	private onTimeUpdate(): void {
		if (this.isLoading) return;
		const audio = this.audio;
		if (!audio || Number.isNaN(audio.currentTime)) return;
		this.currentTime = audio.currentTime;
		this.updateBuffer();
		updatePositionState({ duration: this.duration, position: this.currentTime });

		// Preload next track when entering final 20 seconds
		if (this.duration > 0 && this.duration - this.currentTime <= 20 && this.queue.length > 0) {
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

	play(track: TrackSummary, contextTracks?: TrackSummary[], provenance?: string): void {
		const selectedTrack = this.withProvenance(track, provenance);
		const contextualTracks = contextTracks?.map((candidate) =>
			this.withProvenance(candidate, provenance)
		);

		if (this.currentTrack && this.currentTrack.id !== track.id) {
			this.history.push(this.currentTrack);
		}

		if (contextualTracks && contextualTracks.length > 0) {
			if (this.shuffle) {
				this.queue = createQueueEntries(
					shuffled(contextualTracks.filter((candidate) => candidate.id !== track.id))
				);
			} else {
				const at = contextualTracks.findIndex((candidate) => candidate.id === track.id);
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
		// A direct track choice is a deliberate session change, so subsequent
		// persistence may use its local current-track/history fields again.
		this.reconciliationBase = null;
		this.recordQueueReplacement();
		this.currentTrack = track;
		this.currentTime = 0;
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

	private coverCache = new SvelteMap<string, string>();

	/**
	 * Restore current-track identity from TIDAL when a resumable session only
	 * contains legacy or unresolved identifiers. This is deliberately one track
	 * at a time, does not delay audio, and caches only for the page lifetime.
	 */
	private async resolveTrackMetadata(track: TrackSummary): Promise<void> {
		if (!isBrowser || !needsTrackMetadata(track)) return;

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
				if (!response?.ok) return;
				const body = (await response.json().catch(() => null)) as { track?: unknown } | null;
				if (!isTrackSummary(body?.track) || body.track.id !== track.id) return;
				this.metadataCache.set(track.id, body.track);
				this.applyTrackMetadata(body.track);
			} finally {
				this.metadataRequests.delete(track.id);
			}
		})();

		this.metadataRequests.set(track.id, request);
		return request;
	}

	/**
	 * A saved session can contain several legacy identifier-only entries. Restore
	 * their display data in small batches so the queue and history become useful
	 * without delaying playback or overwhelming the metadata endpoint.
	 */
	private hydrateTrackMetadata(tracks: Iterable<TrackSummary>): void {
		const unresolved = new SvelteMap<string, TrackSummary>();
		for (const track of tracks) {
			if (needsTrackMetadata(track)) unresolved.set(track.id, track);
		}

		const pending = [...unresolved.values()];
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
	private async resolveCover(track: TrackSummary): Promise<void> {
		if (!isBrowser || track.imageUrl) return;
		let url = this.coverCache.get(track.id) ?? null;
		if (!url) {
			try {
				const res = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/cover`);
				const data = res.ok
					? ((await res.json().catch(() => null)) as { imageUrl?: string | null } | null)
					: null;
				url = data?.imageUrl ?? null;
			} catch {
				url = null;
			}
		}
		if (!url) return;
		this.coverCache.set(track.id, url);

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
			this.panel = panel;
			this.isExpanded = true;
		}
		if (panel === 'lyrics' && this.isExpanded && !this.lyrics && this.currentTrack) {
			void this.loadLyrics(this.currentTrack.id);
		}
		this.savePrefs();
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

	private applyVolume(): void {
		if (!this.audio) return;
		this.ensureAudioGraph();

		if (this.isMuted) {
			if (this.gainNode && this.audioContext) {
				const time = this.audioContext.currentTime;
				this.gainNode.gain.cancelScheduledValues(time);
				this.gainNode.gain.setTargetAtTime(0, time, 0.015);
			}
			this.audio.volume = 0;
			this.audio.muted = true;
			return;
		}

		let effVol = this.volume;
		if (this.isNormalizationEnabled && this.trackReplayGain != null) {
			// Convert ReplayGain dB to linear multiplier: 10^(dB/20)
			const multiplier = Math.pow(10, this.trackReplayGain / 20);
			effVol = Math.max(0, this.volume * multiplier);
		}

		if (this.gainNode && this.audioContext) {
			this.audio.volume = 1;
			this.audio.muted = false;
			const time = this.audioContext.currentTime;
			this.gainNode.gain.cancelScheduledValues(time);
			this.gainNode.gain.setTargetAtTime(effVol, time, 0.015);
		} else {
			this.audio.volume = Math.max(0, Math.min(1, effVol));
			this.audio.muted = false;
		}
	}

	private async loadAndPlayStream(trackId: string): Promise<void> {
		this.initAudio();
		this.resumeAudioContext();
		// Freeze the intended start position and silence the outgoing track before
		// the async metadata fetch. `isLoading` gates `onTimeUpdate` so a late
		// `timeupdate` from the old element can't rewrite `currentTime`.
		const startAt = this.currentTime;
		this.audio?.pause();
		this.isLoading = true;

		// Check lookahead preloaded metadata first for zero-latency start
		const preloaded = streamPreloader.consume(trackId);
		let data: PreloadedStreamData | null = preloaded;

		if (!data) {
			// Fetch metadata from /stream endpoint
			try {
				const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/stream`).catch(
					() => null
				);
				if (res && res.ok) {
					data = (await res.json().catch(() => null)) as PreloadedStreamData | null;
				} else if (res) {
					const errData = (await res.json().catch(() => ({}))) as {
						requiresFullAuth?: boolean;
						reason?: string;
					};
					this.requiresFullAuth = errData.requiresFullAuth ?? res.status === 403;
					this.playbackReason = errData.reason ?? `http_${res.status}`;
				}
			} catch {
				this.playbackReason = 'network_error';
			}
		}

		if (data && this.audio) {
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
			this.audio.src = this.streamUrl;
			if (startAt > 0) {
				try {
					this.audio.currentTime = startAt;
				} catch {
					// The stream may not be seekable until metadata arrives.
				}
			}
			this.applyVolume();
			await this.audio.play().catch(() => {
				this.playbackMode = 'embed';
			});
			this.isPlaying = !this.audio.paused;
			this.isLoading = false;

			// Immediately preload the next track in queue
			if (this.queue.length > 0) {
				streamPreloader.preload(this.queue[0].id);
			}
			return;
		}

		// Direct playback unavailable — hand off to the TIDAL embed player
		this.playbackMode = 'embed';
		this.isPlaying = false;
		this.isLoading = false;
		this.isExpanded = true;
	}

	togglePlayPause(): void {
		this.initAudio();
		this.resumeAudioContext();

		if (this.playbackMode === 'embed') {
			// The TIDAL embed iframe owns its own transport; just make sure it is
			// visible so the viewer can use it.
			this.isExpanded = true;
			return;
		}

		if (this.currentTrack && !this.streamUrl) {
			void this.loadAndPlayStream(this.currentTrack.id);
		} else if (this.audio && this.streamUrl) {
			if (this.isPlaying) {
				this.audio.pause();
			} else {
				this.audio.play().catch(() => {
					this.playbackMode = 'embed';
					this.isExpanded = true;
				});
			}
		} else {
			this.isPlaying = !this.isPlaying;
		}
	}

	seek(seconds: number): void {
		const target = Math.max(0, Math.min(seconds, this.duration || 9999));
		this.currentTime = target;
		if (this.audio && !isNaN(target)) {
			this.audio.currentTime = target;
		}
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

	/** Apply server-persisted listening preferences whenever the app shell loads. */
	applyStreamingSettings(settings: { volume: number; loudnessNormalization: boolean }): void {
		this.volume = Math.max(0, Math.min(this.maxVolume, settings.volume / 100));
		this.isMuted = this.volume === 0;
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
		this.queueCommands.push({ type: 'append', entries: [queuedTrack] });
		if (this.queue.length === 1) {
			streamPreloader.preload(queuedTrack.id);
		}
		this.schedulePersistence();
	}

	/** Insert a track directly after the current one without interrupting playback. */
	playNext(track: TrackSummary, provenance?: string): void {
		const queuedTrack = createQueueEntry(this.withProvenance(track, provenance));
		this.queue.unshift(queuedTrack);
		this.queueCommands.push({ type: 'prepend', entry: queuedTrack });
		streamPreloader.preload(queuedTrack.id);
		this.schedulePersistence();
	}

	addMultipleToQueue(tracks: TrackSummary[]): void {
		const entries = createQueueEntries(tracks);
		this.queue.push(...entries);
		this.queueCommands.push({ type: 'append', entries });
		this.schedulePersistence();
	}

	/** Remove one queue occurrence by its stable entry identity. */
	removeFromQueue(entryId: string): void {
		const index = this.queue.findIndex((entry) => entry.entryId === entryId);
		if (index === -1) return;
		this.queue.splice(index, 1);
		this.queueCommands.push({ type: 'remove', entryId });
		this.schedulePersistence();
	}

	clearQueue(): void {
		if (this.queue.length === 0) return;
		this.queue = [];
		this.queueCommands.push({ type: 'clear' });
		this.schedulePersistence();
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
			this.queueCommands.push({
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
		this.schedulePersistence();
	}

	/**
	 * Advance playback. Honours repeat (`one` replays, `all` refills the queue
	 * from history once it empties) and shuffle (picks a random queued track).
	 * @param auto `true` when triggered by a track ending, so repeat-one applies.
	 */
	next(auto = false): TrackSummary | null {
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
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
		}
		this.currentTrack = null;
		this.queue = [];
		this.history = [];
		this.reconciliationBase = null;
		this.recordQueueReplacement();
		this.isExpanded = false;
		this.isPlaying = false;
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
		if (
			this.hasRestoredPlaybackState ||
			this.currentTrack ||
			this.queue.length ||
			this.history.length
		)
			return;
		this.hasRestoredPlaybackState = true;
		this.currentTrack = state.currentTrack;
		this.queue = state.queue.slice(0, MAX_QUEUE_LENGTH);
		this.history = state.history.slice(-MAX_HISTORY_LENGTH);
		this.currentTime = Math.max(0, Math.floor(state.currentTime));
		this.playbackStateRevision = Math.max(0, state.revision ?? 0);
		this.queueCommands = [];
		this.reconciliationBase = null;
		this.reconciliationAttempts = 0;
		this.lastPersistedPosition = this.currentTime;
		this.duration = state.currentTrack?.duration || 0;

		if (this.currentTrack) void this.resolveCover(this.currentTrack);
		this.hydrateTrackMetadata([
			...(this.currentTrack ? [this.currentTrack] : []),
			...this.queue,
			...this.history
		]);
	}

	/**
	 * Reconcile a second open client with the authoritative session. This is a
	 * display/queue refresh only: it never starts, pauses, seeks, or replaces
	 * audio that is already playing in this browser.
	 */
	async syncPlaybackState(): Promise<void> {
		if (!isBrowser || this.sessionSyncInFlight || this.persistenceInFlight) return;
		this.sessionSyncInFlight = true;

		try {
			const response = await fetch('/api/playback-state', {
				headers: { accept: 'application/json' },
				cache: 'no-store'
			});
			const state = (await response.json().catch(() => null)) as unknown;
			if (!response.ok || !isSavedPlaybackState(state)) {
				this.sessionSyncFailures += 1;
				return;
			}

			this.sessionSyncFailures = 0;
			if (state.revision < this.playbackStateRevision) return;

			if (this.queueCommands.length > 0) {
				if (state.revision === this.playbackStateRevision) return;
				this.reconciliationBase = state;
				this.playbackStateRevision = state.revision;
				this.queue = rebaseQueue(state.queue, this.queueCommands, MAX_QUEUE_LENGTH);
				this.reconciliationAttempts = 0;
				this.hydrateTrackMetadata(this.queue);
				this.schedulePersistence();
				return;
			}

			if (state.revision === this.playbackStateRevision) {
				if (!this.persistenceInFlight && this.persistenceStatus === 'offline') {
					this.persistenceStatus = 'saved';
				}
				return;
			}

			this.playbackStateRevision = state.revision;
			this.queue = state.queue.slice(0, MAX_QUEUE_LENGTH);
			this.hydrateTrackMetadata(this.queue);
			// A paused media element is still this device's local listening context.
			// Do not make its next Play action start the old source under remote art.
			const hasLocalMedia = Boolean(this.streamUrl || this.audio?.currentSrc);
			if (!this.isPlaying && !hasLocalMedia) {
				this.currentTrack = state.currentTrack;
				this.history = state.history.slice(-MAX_HISTORY_LENGTH);
				this.currentTime = Math.max(0, Math.floor(state.currentTime));
				this.duration = state.currentTrack?.duration ?? 0;
				if (this.currentTrack) void this.resolveCover(this.currentTrack);
				this.hydrateTrackMetadata([
					...(this.currentTrack ? [this.currentTrack] : []),
					...this.history
				]);
			}

			if (!this.persistenceInFlight && this.persistenceStatus === 'offline') {
				this.persistenceStatus = 'saved';
			}
		} catch {
			// A background read is not an unsaved queue edit. Preserve playback and
			// let the next bounded poll retry without showing a false warning.
			this.sessionSyncFailures += 1;
		} finally {
			this.sessionSyncInFlight = false;
		}
	}

	/** Start bounded, visibility-aware session refreshes for an app shell. */
	startSessionSync(): void {
		if (!isBrowser || this.sessionSyncActive) return;
		this.sessionSyncActive = true;

		const refreshWhenVisible = () => {
			if (document.visibilityState !== 'visible') return;
			void this.syncPlaybackState().finally(() => this.scheduleSessionSync());
		};

		document.addEventListener('visibilitychange', refreshWhenVisible);
		window.addEventListener('focus', refreshWhenVisible);
		window.addEventListener('online', refreshWhenVisible);
		refreshWhenVisible();
	}

	private scheduleSessionSync(): void {
		if (!this.sessionSyncActive || document.visibilityState !== 'visible') return;
		if (this.sessionSyncTimer) clearTimeout(this.sessionSyncTimer);
		const delay = Math.min(30_000, 2_000 * 2 ** this.sessionSyncFailures);
		this.sessionSyncTimer = setTimeout(() => {
			void this.syncPlaybackState().finally(() => this.scheduleSessionSync());
		}, delay);
	}

	private recordQueueReplacement(): void {
		this.queueCommands = [{ type: 'replace', entries: this.queue.slice(0, MAX_QUEUE_LENGTH) }];
	}

	private snapshotPlaybackState(): PlaybackPersistenceSnapshot {
		const base = this.reconciliationBase;
		return {
			currentTrack: base?.currentTrack ?? this.currentTrack,
			queue: this.queue.slice(0, MAX_QUEUE_LENGTH),
			history: (base?.history ?? this.history).slice(-MAX_HISTORY_LENGTH),
			currentTime: Math.max(0, Math.floor(base?.currentTime ?? this.currentTime)),
			revision: this.playbackStateRevision,
			origin: this.origin,
			queueCommands: this.queueCommands.slice()
		};
	}

	private queueOperationId(command: QueueCommand): string {
		if (!command.operationId) command.operationId = `operation_${crypto.randomUUID()}`;
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
	private async persistQueueCommands(): Promise<boolean> {
		while (this.queueCommands.length > 0) {
			const command = this.queueCommands[0];
			if (!command) return true;
			const operationId = this.queueOperationId(command);
			const response = await fetch('/api/playback-state/intents', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					version: 2,
					expectedRevision: this.playbackStateRevision,
					operationId,
					origin: this.origin,
					intent: this.queueIntentPayload(command)
				}),
				keepalive: true
			});
			const state = (await response.json().catch(() => null)) as SavedPlaybackState | null;
			if (
				!state ||
				!Array.isArray(state.queue) ||
				typeof state.revision !== 'number' ||
				!Number.isSafeInteger(state.revision)
			) {
				this.persistenceStatus = 'offline';
				return false;
			}

			if (response.status === 409) {
				if (this.reconciliationAttempts >= 1) {
					this.persistenceStatus = 'conflict';
					return false;
				}
				this.reconciliationBase = state;
				this.playbackStateRevision = state.revision;
				this.queue = rebaseQueue(state.queue, this.queueCommands, MAX_QUEUE_LENGTH);
				this.reconciliationAttempts += 1;
				continue;
			}
			if (!response.ok) {
				this.persistenceStatus = 'offline';
				return false;
			}

			this.playbackStateRevision = state.revision;
			if (this.queueCommands[0]?.operationId === operationId) this.queueCommands.shift();
			this.reconciliationBase = null;
			this.reconciliationAttempts = 0;
		}
		return true;
	}

	/**
	 * Refresh a queue after the automatic stale-write retry has also conflicted.
	 * The currently audible track remains local; only deliberate queue commands
	 * are replayed over the latest server queue before one new conditional write.
	 */
	async refreshQueueFromServer(): Promise<void> {
		if (!isBrowser || this.persistenceStatus !== 'conflict') return;
		this.persistenceStatus = 'saving';

		try {
			const response = await fetch('/api/playback-state', {
				headers: { accept: 'application/json' },
				cache: 'no-store'
			});
			const state = (await response.json().catch(() => null)) as SavedPlaybackState | null;
			if (
				!response.ok ||
				!state ||
				!Array.isArray(state.queue) ||
				!Array.isArray(state.history) ||
				typeof state.currentTime !== 'number' ||
				typeof state.revision !== 'number' ||
				!Number.isSafeInteger(state.revision)
			) {
				this.persistenceStatus = 'offline';
				return;
			}

			this.reconciliationBase = state;
			this.playbackStateRevision = state.revision;
			this.queue = rebaseQueue(state.queue, this.queueCommands, MAX_QUEUE_LENGTH);
			this.reconciliationAttempts = 0;

			if (this.queueCommands.length === 0) {
				this.reconciliationBase = null;
				this.persistenceStatus = 'saved';
				return;
			}

			await this.persistPlaybackState();
		} catch {
			this.persistenceStatus = 'offline';
		}
	}

	private schedulePersistence(): void {
		if (!isBrowser || !this.hasRestoredPlaybackState) return;
		if (this.persistenceStatus === 'conflict') return;
		this.persistenceStatus = 'saving';
		if (this.persistenceTimer) clearTimeout(this.persistenceTimer);
		this.persistenceTimer = setTimeout(() => {
			this.persistenceTimer = undefined;
			void this.persistPlaybackState();
		}, 500);
	}

	private async persistPlaybackState(): Promise<void> {
		if (this.persistenceInFlight) {
			this.persistenceQueued = true;
			return;
		}

		this.persistenceInFlight = true;
		try {
			if (this.queueCommands.length > 0 && !(await this.persistQueueCommands())) return;
			const snapshot = this.snapshotPlaybackState();
			const response = await fetch('/api/playback-state', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(snapshot),
				keepalive: true
			});
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
					this.persistenceStatus = 'conflict';
					return;
				}

				// Preserve the currently audible track in this tab. Only its deliberate
				// queue commands are rebased onto the authoritative server queue; the
				// next write carries the returned current/history/position unchanged.
				this.reconciliationBase = state;
				this.playbackStateRevision = state.revision;
				this.queue = rebaseQueue(state.queue, this.queueCommands, MAX_QUEUE_LENGTH);
				this.reconciliationAttempts += 1;
				this.persistenceQueued = true;
				this.persistenceStatus = 'saving';
				return;
			}
			if (
				!response.ok ||
				typeof state?.revision !== 'number' ||
				!Number.isSafeInteger(state.revision)
			) {
				this.persistenceStatus = 'offline';
				return;
			}

			this.playbackStateRevision = state.revision;
			this.queueCommands.splice(0, snapshot.queueCommands.length);
			this.reconciliationBase = null;
			this.reconciliationAttempts = 0;
			this.persistenceStatus = 'saved';
		} catch {
			// Resume state is a convenience; playback must remain usable offline.
			this.persistenceStatus = 'offline';
		} finally {
			this.persistenceInFlight = false;
			if (this.persistenceQueued && this.persistenceStatus !== 'conflict') {
				this.persistenceQueued = false;
				void this.persistPlaybackState();
			}
		}
	}
}

export const player = new PlayerState();
