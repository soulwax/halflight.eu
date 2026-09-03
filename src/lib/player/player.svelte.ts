import type { TrackSummary } from '#lib/server/tidal/models';
import { assessPlayback, type PlaybackAssessment } from './playback-assessment';

export interface SavedPlaybackState {
	currentTrack: TrackSummary | null;
	queue: TrackSummary[];
	history: TrackSummary[];
	currentTime: number;
}

export type DockMode = 'docked' | 'floating';
export type RepeatMode = 'off' | 'all' | 'one';
export type PlayerPanel = 'queue' | 'lyrics' | 'source';

interface PlayerPrefs {
	dockMode: DockMode;
	shuffle: boolean;
	repeatMode: RepeatMode;
	floatingPos: { x: number; y: number };
	panel: PlayerPanel;
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

	// Audio playback engine states
	isPlaying = $state(false);
	isLoading = $state(false);
	currentTime = $state(0);
	duration = $state(0);
	volume = $state(1);
	isMuted = $state(false);
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
	private hasRestoredPlaybackState = false;
	private persistenceTimer: ReturnType<typeof setTimeout> | undefined;
	private lastPersistedPosition = 0;

	constructor() {
		if (isBrowser) {
			this.loadPrefs();
			this.initAudio();
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
				panel: this.panel
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

		this.audio.addEventListener('timeupdate', () => {
			if (this.audio && !isNaN(this.audio.currentTime)) {
				this.currentTime = this.audio.currentTime;
				if (Math.abs(this.currentTime - this.lastPersistedPosition) >= 15) {
					this.lastPersistedPosition = this.currentTime;
					this.schedulePersistence();
				}
			}
		});

		const onMeta = () => {
			if (this.audio && !isNaN(this.audio.duration) && this.audio.duration > 0) {
				this.duration = this.audio.duration;
				this.hasMediaMetadata = true;
			}
		};
		this.audio.addEventListener('durationchange', onMeta);
		this.audio.addEventListener('loadedmetadata', onMeta);

		this.audio.addEventListener('play', () => {
			this.isPlaying = true;
		});

		this.audio.addEventListener('pause', () => {
			this.isPlaying = false;
		});

		this.audio.addEventListener('ended', () => {
			this.next(true);
		});

		this.audio.addEventListener('error', () => {
			// Fall back to embed if direct stream encounters an error
			this.playbackMode = 'embed';
			this.isPlaying = false;
			this.isLoading = false;
		});
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

	play(track: TrackSummary, contextTracks?: TrackSummary[]): void {
		if (this.currentTrack && this.currentTrack.id !== track.id) {
			this.history.push(this.currentTrack);
		}
		this.currentTrack = track;
		this.currentTime = 0;
		this.duration = track.duration || 0;
		this.hasMediaMetadata = false;
		this.requestedQuality = null;
		this.audioQuality = null;
		this.codecs = null;
		this.lyrics = null;
		this.lyricsCues = [];
		this.playbackMode = 'direct';
		this.playbackReason = null;
		this.requiresFullAuth = false;

		if (contextTracks && contextTracks.length > 0) {
			if (this.shuffle) {
				this.queue = shuffled(contextTracks.filter((t) => t.id !== track.id));
			} else {
				const at = contextTracks.findIndex((t) => t.id === track.id);
				this.queue = at === -1 ? [...contextTracks] : contextTracks.slice(at + 1);
			}
		}
		this.schedulePersistence();

		if (isBrowser) {
			this.loadAndPlayStream(track.id);
			this.loadLyrics(track.id);
		}
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
			this.loadLyrics(this.currentTrack.id);
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

	toggleNormalization(): void {
		this.isNormalizationEnabled = !this.isNormalizationEnabled;
		this.applyVolume();
	}

	private applyVolume(): void {
		if (!this.audio) return;
		if (this.isMuted) {
			this.audio.volume = 0;
			this.audio.muted = true;
			return;
		}

		let effVol = this.volume;
		if (this.isNormalizationEnabled && this.trackReplayGain != null) {
			// Convert ReplayGain dB to linear multiplier: 10^(dB/20)
			const multiplier = Math.pow(10, this.trackReplayGain / 20);
			effVol = Math.max(0, Math.min(1, this.volume * multiplier));
		}

		this.audio.volume = effVol;
		this.audio.muted = false;
	}

	private async loadAndPlayStream(trackId: string): Promise<void> {
		this.initAudio();
		this.isLoading = true;

		// Fetch metadata from /stream endpoint
		try {
			const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/stream`).catch(
				() => null
			);
			if (res && res.ok) {
				const data = (await res.json().catch(() => null)) as {
					audioQuality?: string;
					audioMode?: string;
					requestedQuality?: string | null;
					codecs?: string;
					fileExtension?: string;
					bitDepth?: number | null;
					sampleRate?: number | null;
					trackReplayGain?: number | null;
					isPreview?: boolean;
					requiresFullAuth?: boolean;
				} | null;

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
					if (this.currentTime > 0) {
						try {
							this.audio.currentTime = this.currentTime;
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
					return;
				}
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

		// Direct playback unavailable — hand off to the TIDAL embed player, which
		// works for previews (and full tracks when the viewer is signed in to
		// TIDAL). Surface it immediately instead of silently doing nothing.
		this.playbackMode = 'embed';
		this.isPlaying = false;
		this.isLoading = false;
		this.isExpanded = true;
	}

	togglePlayPause(): void {
		this.initAudio();

		if (this.playbackMode === 'embed') {
			// The TIDAL embed iframe owns its own transport; just make sure it is
			// visible so the viewer can use it.
			this.isExpanded = true;
			return;
		}

		if (this.currentTrack && !this.streamUrl) {
			this.loadAndPlayStream(this.currentTrack.id);
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

	setVolume(vol: number): void {
		const clamped = Math.max(0, Math.min(vol, 1));
		this.volume = clamped;
		this.isMuted = clamped === 0;
		this.applyVolume();
	}

	/** Apply server-persisted listening preferences whenever the app shell loads. */
	applyStreamingSettings(settings: { volume: number; loudnessNormalization: boolean }): void {
		this.volume = Math.max(0, Math.min(1, settings.volume / 100));
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

	addToQueue(track: TrackSummary): void {
		this.queue.push(track);
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
			if (isBrowser) this.loadAndPlayStream(this.currentTrack.id);
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
		this.currentTrack = nextTrack;
		this.currentTime = 0;
		this.duration = nextTrack.duration || 0;
		if (isBrowser) {
			this.loadAndPlayStream(nextTrack.id);
		}
		this.schedulePersistence();
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
		this.currentTrack = prevTrack;
		this.currentTime = 0;
		this.duration = prevTrack.duration || 0;
		if (isBrowser) {
			this.loadAndPlayStream(prevTrack.id);
		}
		this.schedulePersistence();
		return prevTrack;
	}

	playFromQueue(index: number): void {
		if (index < 0 || index >= this.queue.length) return;
		if (this.currentTrack) {
			this.history.push(this.currentTrack);
		}
		const [targetTrack] = this.queue.splice(index, 1);
		this.currentTrack = targetTrack;
		this.currentTime = 0;
		this.duration = targetTrack.duration || 0;
		if (isBrowser) {
			this.loadAndPlayStream(targetTrack.id);
		}
		this.schedulePersistence();
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
		this.streamUrl = null;
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
		this.lastPersistedPosition = this.currentTime;
		this.duration = state.currentTrack?.duration || 0;
	}

	private snapshotPlaybackState(): SavedPlaybackState {
		return {
			currentTrack: this.currentTrack,
			queue: this.queue.slice(0, MAX_QUEUE_LENGTH),
			history: this.history.slice(-MAX_HISTORY_LENGTH),
			currentTime: Math.max(0, Math.floor(this.currentTime))
		};
	}

	private schedulePersistence(): void {
		if (!isBrowser || !this.hasRestoredPlaybackState) return;
		if (this.persistenceTimer) clearTimeout(this.persistenceTimer);
		this.persistenceTimer = setTimeout(() => {
			this.persistenceTimer = undefined;
			void fetch('/api/playback-state', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(this.snapshotPlaybackState()),
				keepalive: true
			}).catch(() => {
				// Resume state is a convenience; playback must remain usable offline.
			});
		}, 500);
	}
}

export const player = new PlayerState();
