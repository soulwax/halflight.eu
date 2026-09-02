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

	play(track: TrackSummary, contextTracks?: TrackSummary[]): void {
		if (this.currentTrack && this.currentTrack.id !== track.id) {
			this.history.push(this.currentTrack);
		}
		this.currentTrack = track;
		this.currentTime = 0;
		this.duration = track.duration || 0;

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
		}
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
					audioMode?: string;
				} | null;

				if (data?.streamUrl && this.audio) {
					this.streamUrl = data.streamUrl;
					this.audioQuality = data.audioMode || 'HIGH';
					this.playbackMode = 'direct';
					this.audio.src = data.streamUrl;
					this.audio.volume = this.isMuted ? 0 : this.volume;
					await this.audio.play().catch(() => {});
					this.isPlaying = true;
					this.isLoading = false;
					return;
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
		if (this.audio) {
			this.audio.volume = clamped;
			this.audio.muted = this.isMuted;
		}
	}

	toggleMute(): void {
		this.isMuted = !this.isMuted;
		if (this.audio) {
			this.audio.muted = this.isMuted;
		}
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
