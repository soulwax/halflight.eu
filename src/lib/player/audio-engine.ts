export interface AudioEngineCallbacks {
	onTimeUpdate: (currentTime: number) => void;
	onMetadata: (duration: number) => void;
	onPlay: () => void;
	onPause: () => void;
	onEnded: () => void;
	onError: () => void;
	onBufferUpdate: (bufferedPercent: number) => void;
	onBufferingChange: (isBuffering: boolean) => void;
}

const isBrowser = typeof window !== 'undefined';

export class AudioEngine {
	private audio: HTMLAudioElement | null = null;
	private audioContext: AudioContext | null = null;
	private mediaSourceNode: MediaElementAudioSourceNode | null = null;
	private gainNode: GainNode | null = null;
	private callbacks: AudioEngineCallbacks;

	private stallTimeout: ReturnType<typeof setTimeout> | undefined;
	private isBuffering = false;

	constructor(callbacks: AudioEngineCallbacks) {
		this.callbacks = callbacks;
		if (isBrowser) {
			this.initAudio();
			this.setupLifecycleListeners();
		}
	}

	private initAudio(): void {
		if (!isBrowser || typeof Audio === 'undefined') return;
		if (this.audio) return;

		this.audio = new Audio();
		this.audio.preload = 'auto';

		this.audio.addEventListener('timeupdate', () => {
			if (!this.audio) return;
			this.clearStallWatchdog();
			if (this.isBuffering) {
				this.isBuffering = false;
				this.callbacks.onBufferingChange(false);
			}
			this.callbacks.onTimeUpdate(this.audio.currentTime);
			this.updateBuffer();
		});

		const onMeta = () => {
			if (this.audio && !Number.isNaN(this.audio.duration) && this.audio.duration > 0) {
				this.callbacks.onMetadata(this.audio.duration);
				this.updateBuffer();
			}
		};
		this.audio.addEventListener('durationchange', onMeta);
		this.audio.addEventListener('loadedmetadata', onMeta);
		this.audio.addEventListener('progress', () => this.updateBuffer());

		this.audio.addEventListener('play', () => {
			this.clearStallWatchdog();
			this.callbacks.onPlay();
		});

		this.audio.addEventListener('pause', () => {
			this.clearStallWatchdog();
			this.callbacks.onPause();
		});

		this.audio.addEventListener('ended', () => {
			this.clearStallWatchdog();
			this.callbacks.onEnded();
		});

		this.audio.addEventListener('waiting', () => {
			this.isBuffering = true;
			this.callbacks.onBufferingChange(true);
			this.armStallWatchdog();
		});

		this.audio.addEventListener('stalled', () => {
			this.armStallWatchdog();
		});

		this.audio.addEventListener('playing', () => {
			this.clearStallWatchdog();
			if (this.isBuffering) {
				this.isBuffering = false;
				this.callbacks.onBufferingChange(false);
			}
		});

		this.audio.addEventListener('error', () => {
			this.clearStallWatchdog();
			this.callbacks.onError();
		});
	}

	private setupLifecycleListeners(): void {
		if (!isBrowser) return;

		// Re-arm audio context on visibility / tab wake
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				this.resumeContext();
			}
		});

		// Auto-reconnect when device comes back online
		window.addEventListener('online', () => {
			this.resumeContext();
		});
	}

	private updateBuffer(): void {
		if (!this.audio || !this.audio.duration || Number.isNaN(this.audio.duration)) return;
		const buffered = this.audio.buffered;
		if (buffered.length === 0) {
			this.callbacks.onBufferUpdate(0);
			return;
		}

		const current = this.audio.currentTime;
		for (let i = 0; i < buffered.length; i++) {
			if (buffered.start(i) <= current && current <= buffered.end(i)) {
				const percent = Math.min(100, Math.max(0, (buffered.end(i) / this.audio.duration) * 100));
				this.callbacks.onBufferUpdate(percent);
				return;
			}
		}

		// Fallback to highest buffered range
		const lastEnd = buffered.end(buffered.length - 1);
		const fallbackPercent = Math.min(100, Math.max(0, (lastEnd / this.audio.duration) * 100));
		this.callbacks.onBufferUpdate(fallbackPercent);
	}

	private armStallWatchdog(): void {
		this.clearStallWatchdog();
		this.stallTimeout = setTimeout(() => {
			if (this.audio && !this.audio.paused && this.audio.readyState < 3) {
				// Attempt a micro-nudge to restart stalled HTTP Range buffer
				try {
					const pos = this.audio.currentTime;
					this.audio.currentTime = pos;
					void this.audio.play().catch(() => {});
				} catch {
					// Nudge is best-effort
				}
			}
		}, 3500);
	}

	private clearStallWatchdog(): void {
		if (this.stallTimeout) {
			clearTimeout(this.stallTimeout);
			this.stallTimeout = undefined;
		}
	}

	ensureAudioGraph(): void {
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
			// Web Audio API is best-effort fallback to standard audio.volume
		}
	}

	resumeContext(): void {
		if (this.audioContext && this.audioContext.state === 'suspended') {
			void this.audioContext.resume().catch(() => {});
		}
	}

	setSource(url: string, startAt = 0): void {
		this.initAudio();
		this.resumeContext();
		if (!this.audio) return;
		this.audio.src = url;
		if (startAt > 0) {
			try {
				this.audio.currentTime = startAt;
			} catch {
				// Stream may not be seekable yet
			}
		}
	}

	async play(): Promise<boolean> {
		this.initAudio();
		this.resumeContext();
		if (!this.audio) return false;
		try {
			await this.audio.play();
			return !this.audio.paused;
		} catch {
			return false;
		}
	}

	pause(): void {
		this.audio?.pause();
	}

	seek(seconds: number): void {
		if (!this.audio || Number.isNaN(seconds)) return;
		try {
			this.audio.currentTime = seconds;
		} catch {
			// Non-seekable stream fallback
		}
	}

	/**
	 * De-clicking smooth volume application using Web Audio gain ramp.
	 */
	applyVolume(effVol: number, isMuted: boolean): void {
		if (!this.audio) return;
		this.ensureAudioGraph();

		const target = isMuted ? 0 : Math.max(0, effVol);

		if (this.gainNode && this.audioContext) {
			this.audio.volume = 1;
			this.audio.muted = false;
			const time = this.audioContext.currentTime;
			// 15ms exponential de-clicking ramp
			this.gainNode.gain.cancelScheduledValues(time);
			this.gainNode.gain.setTargetAtTime(target, time, 0.015);
		} else {
			this.audio.volume = Math.max(0, Math.min(1, target));
			this.audio.muted = isMuted;
		}
	}

	isPaused(): boolean {
		return !this.audio || this.audio.paused;
	}

	getCurrentTime(): number {
		return this.audio?.currentTime ?? 0;
	}

	getDuration(): number {
		return this.audio?.duration ?? 0;
	}

	destroy(): void {
		this.clearStallWatchdog();
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
		if (this.audioContext && this.audioContext.state !== 'closed') {
			void this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}
		this.mediaSourceNode = null;
		this.gainNode = null;
	}
}
