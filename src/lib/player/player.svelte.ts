import type { TrackSummary } from '#lib/server/tidal/models';

const isBrowser = typeof window !== 'undefined';

export class PlayerState {
	currentTrack = $state<TrackSummary | null>(null);
	queue = $state<TrackSummary[]>([]);
	history = $state<TrackSummary[]>([]);
	isQueueOpen = $state(false);
	isExpanded = $state(false);
	isCoverExpanded = $state(false);

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
	codecs = $state<string | null>(null);
	fileExtension = $state<string | null>(null);
	bitDepth = $state<number | null>(null);
	sampleRate = $state<number | null>(null);
	trackReplayGain = $state<number | null>(null);
	isNormalizationEnabled = $state(true);
	requiresFullAuth = $state(false);

	// Synchronized Lyrics state
	lyrics = $state<string | null>(null);
	lyricsCues = $state<Array<{ time: number; text: string }>>([]);
	isLyricsOpen = $state(false);
	isLyricsLoading = $state(false);

	private audio: HTMLAudioElement | null = null;

	constructor() {
		if (isBrowser) {
			this.initAudio();
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
			}
		});

		this.audio.addEventListener('durationchange', () => {
			if (this.audio && !isNaN(this.audio.duration) && this.audio.duration > 0) {
				this.duration = this.audio.duration;
			}
		});

		this.audio.addEventListener('play', () => {
			this.isPlaying = true;
		});

		this.audio.addEventListener('pause', () => {
			this.isPlaying = false;
		});

		this.audio.addEventListener('ended', () => {
			this.next();
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
		this.lyrics = null;
		this.lyricsCues = [];

		if (contextTracks && contextTracks.length > 0) {
			const trackIndex = contextTracks.findIndex((t) => t.id === track.id);
			if (trackIndex !== -1) {
				this.queue = contextTracks.slice(trackIndex + 1);
			} else {
				this.queue = [...contextTracks];
			}
		}

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

	toggleLyrics(): void {
		this.isLyricsOpen = !this.isLyricsOpen;
		if (this.isLyricsOpen && !this.lyrics && this.currentTrack) {
			this.loadLyrics(this.currentTrack.id);
		}
	}

	closeLyrics(): void {
		this.isLyricsOpen = false;
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

		try {
			const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/stream`).catch(
				() => null
			);
			if (res && res.ok) {
				const data = (await res.json().catch(() => null)) as {
					streamUrl?: string;
					audioQuality?: string;
					audioMode?: string;
					codecs?: string;
					fileExtension?: string;
					bitDepth?: number | null;
					sampleRate?: number | null;
					trackReplayGain?: number | null;
				} | null;

				if (data?.streamUrl && this.audio) {
					this.streamUrl = data.streamUrl;
					this.audioQuality = data.audioQuality || data.audioMode || 'HIGH';
					this.codecs = data.codecs || null;
					this.fileExtension = data.fileExtension || null;
					this.bitDepth = data.bitDepth ?? null;
					this.sampleRate = data.sampleRate ?? null;
					this.trackReplayGain = data.trackReplayGain ?? null;
					this.requiresFullAuth = false;
					this.playbackMode = 'direct';
					this.audio.src = data.streamUrl;
					this.applyVolume();
					await this.audio.play().catch(() => {});
					this.isPlaying = true;
					this.isLoading = false;
					return;
				}
			} else if (res && res.status === 403) {
				const errData = (await res.json().catch(() => ({}))) as { requiresFullAuth?: boolean };
				if (errData.requiresFullAuth) {
					this.requiresFullAuth = true;
				}
			}
		} catch {
			// Network error or playback rejected
		}

		// Fallback to embed
		this.playbackMode = 'embed';
		this.isLoading = false;
	}

	togglePlayPause(): void {
		this.initAudio();

		if (this.audio && this.streamUrl) {
			if (this.isPlaying) {
				this.audio.pause();
			} else {
				this.audio.play().catch(() => {
					this.playbackMode = 'embed';
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
	}

	setVolume(vol: number): void {
		const clamped = Math.max(0, Math.min(vol, 1));
		this.volume = clamped;
		this.isMuted = clamped === 0;
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
	}

	addMultipleToQueue(tracks: TrackSummary[]): void {
		this.queue.push(...tracks);
	}

	removeFromQueue(index: number): void {
		if (index >= 0 && index < this.queue.length) {
			this.queue.splice(index, 1);
		}
	}

	clearQueue(): void {
		this.queue = [];
	}

	next(): TrackSummary | null {
		if (this.queue.length === 0) return null;
		if (this.currentTrack) {
			this.history.push(this.currentTrack);
		}
		const nextTrack = this.queue.shift()!;
		this.currentTrack = nextTrack;
		this.currentTime = 0;
		this.duration = nextTrack.duration || 0;
		if (isBrowser) {
			this.loadAndPlayStream(nextTrack.id);
		}
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
	}

	toggleQueue(): void {
		this.isQueueOpen = !this.isQueueOpen;
	}

	closeQueue(): void {
		this.isQueueOpen = false;
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
		this.isQueueOpen = false;
		this.isPlaying = false;
		this.currentTime = 0;
		this.duration = 0;
		this.streamUrl = null;
	}
}

export const player = new PlayerState();
