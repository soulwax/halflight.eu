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
import { streamPreloader, type PreloadedStreamData } from './stream-preloader.js';

/** Which site persisted a queue/position write — see MASTERPLAN.md's session contract. */
export type PlaybackOrigin = 'listening-room' | 'halflight-now';

export interface SavedPlaybackState {
	currentTrack: TrackSummary | null;
	queue: TrackSummary[];
	history: TrackSummary[];
	currentTime: number;
	revision?: number;
	lastOrigin?: PlaybackOrigin | null;
}

interface PlaybackStateWrite extends SavedPlaybackState {
	revision: number;
	origin: PlaybackOrigin;
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

export class PlayerState {
	currentTrack = $state<TrackSummary | null>(null);
	queue = $state<TrackSummary[]>([]);
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
	private lastPersistedPosition = 0;
	private trackStartedAt = 0;
	private lastObservedPlaybackTime = 0;
	private listenedSeconds = 0;
	private reportedNowPlaying = false;
	private scrobbledCurrentTrack = false;

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
				this.queue = shuffled(contextualTracks.filter((candidate) => candidate.id !== track.id));
			} else {
				const at = contextualTracks.findIndex((candidate) => candidate.id === track.id);
				this.queue = at === -1 ? [...contextualTracks] : contextualTracks.slice(at + 1);
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
		this.queue = this.queue.map(patched);
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
		const queuedTrack = this.withProvenance(track, provenance);
		this.queue.push(queuedTrack);
		if (this.queue.length === 1) {
			streamPreloader.preload(queuedTrack.id);
		}
		this.schedulePersistence();
	}

	/** Insert a track directly after the current one without interrupting playback. */
	playNext(track: TrackSummary, provenance?: string): void {
		const queuedTrack = this.withProvenance(track, provenance);
		this.queue.unshift(queuedTrack);
		streamPreloader.preload(queuedTrack.id);
		this.schedulePersistence();
	}

	addMultipleToQueue(tracks: TrackSummary[]): void {
		this.queue.push(...tracks);
		this.schedulePersistence();
	}

	removeFromQueue(index: number): void {
		if (index >= 0 && index < this.queue.length) {
			this.queue.splice(index, 1);
			this.schedulePersistence();
		}
	}

	clearQueue(): void {
		this.queue = [];
		this.schedulePersistence();
	}

	/** Move a queued track one slot up (`-1`) or down (`1`). */
	moveQueueItem(index: number, direction: -1 | 1): void {
		const target = index + direction;
		if (index < 0 || index >= this.queue.length || target < 0 || target >= this.queue.length)
			return;
		[this.queue[index], this.queue[target]] = [this.queue[target], this.queue[index]];
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
			this.queue = this.shuffle ? shuffled(loop) : loop;
		}

		if (this.currentTrack) this.history.push(this.currentTrack);
		const index = this.shuffle ? Math.floor(Math.random() * this.queue.length) : 0;
		const [nextTrack] = this.queue.splice(index, 1);
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
			this.queue.unshift(this.currentTrack);
		}
		this.switchToTrack(prevTrack);
		return prevTrack;
	}

	playFromQueue(index: number): void {
		if (index < 0 || index >= this.queue.length) return;
		if (this.currentTrack) {
			this.history.push(this.currentTrack);
		}
		const [targetTrack] = this.queue.splice(index, 1);
		this.switchToTrack(targetTrack);
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
		this.lastPersistedPosition = this.currentTime;
		this.duration = state.currentTrack?.duration || 0;

		if (this.currentTrack) void this.resolveCover(this.currentTrack);
	}

	private snapshotPlaybackState(): PlaybackStateWrite {
		return {
			currentTrack: this.currentTrack,
			queue: this.queue.slice(0, MAX_QUEUE_LENGTH),
			history: this.history.slice(-MAX_HISTORY_LENGTH),
			currentTime: Math.max(0, Math.floor(this.currentTime)),
			revision: this.playbackStateRevision,
			origin: this.origin
		};
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
		const snapshot = this.snapshotPlaybackState();
		try {
			const response = await fetch('/api/playback-state', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(snapshot),
				keepalive: true
			});
			const state = (await response.json().catch(() => null)) as { revision?: unknown } | null;
			if (response.status === 409) {
				// Do not attach the server's newer revision to this stale snapshot: that
				// would overwrite an accepted remote queue. The local audio session stays
				// intact until an explicit reconciliation flow resolves the conflict.
				this.persistenceQueued = false;
				this.persistenceStatus = 'conflict';
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
