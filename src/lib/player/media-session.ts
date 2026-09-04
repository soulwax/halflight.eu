import type { TrackSummary } from '#lib/tidal/models.js';

export interface MediaSessionHandlers {
	onPlay: () => void;
	onPause: () => void;
	onPrevious: () => void;
	onNext: () => void;
	onSeekBackward?: (seconds: number) => void;
	onSeekForward?: (seconds: number) => void;
	onSeekTo?: (time: number) => void;
	onStop?: () => void;
}

function isMediaSessionSupported(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		'mediaSession' in navigator &&
		Boolean(navigator.mediaSession)
	);
}

/**
 * Updates OS media session metadata (title, artist, album, artwork sizes).
 * Renders on lock screens, Mac Now Playing, and Bluetooth audio devices.
 */
export function updateMediaMetadata(track: TrackSummary | null): void {
	if (!isMediaSessionSupported()) return;

	if (!track) {
		navigator.mediaSession.metadata = null;
		return;
	}

	const artistNames = track.artists.map((a) => a.name).join(', ') || 'Unknown Artist';
	const albumTitle = track.album?.title || '';
	const artworkUrl = track.imageUrl || track.album?.imageUrl || '';

	const artwork: MediaImage[] = [];
	if (artworkUrl) {
		const sizes = ['96x96', '128x128', '192x192', '256x256', '512x512'];
		for (const size of sizes) {
			artwork.push({
				src: artworkUrl,
				sizes: size,
				type: 'image/jpeg'
			});
		}
	}

	try {
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: artistNames,
			album: albumTitle,
			artwork
		});
	} catch {
		// Best-effort OS metadata registration
	}
}

/**
 * Updates OS playback state ('playing' | 'paused' | 'none').
 */
export function updatePlaybackState(isPlaying: boolean): void {
	if (!isMediaSessionSupported()) return;
	try {
		navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
	} catch {
		// Best-effort playback state update
	}
}

/**
 * Updates OS playback position and duration for lockscreen scrub bars.
 */
export function updatePositionState(params: {
	duration: number;
	position: number;
	playbackRate?: number;
}): void {
	if (!isMediaSessionSupported() || !('setPositionState' in navigator.mediaSession)) return;

	const duration = Math.max(0, params.duration);
	const position = Math.max(0, Math.min(params.position, duration));
	const playbackRate = params.playbackRate ?? 1;

	if (duration <= 0 || Number.isNaN(duration) || Number.isNaN(position)) return;

	try {
		navigator.mediaSession.setPositionState({
			duration,
			playbackRate,
			position
		});
	} catch {
		// Best-effort position telemetry
	}
}

/**
 * Registers OS hardware media keys and remote command handlers.
 */
export function setupMediaSessionHandlers(handlers: MediaSessionHandlers): void {
	if (!isMediaSessionSupported()) return;

	const ms = navigator.mediaSession;
	const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
		try {
			ms.setActionHandler(action, handler);
		} catch {
			// Action may not be supported by the current browser
		}
	};

	safeSet('play', () => handlers.onPlay());
	safeSet('pause', () => handlers.onPause());
	safeSet('previoustrack', () => handlers.onPrevious());
	safeSet('nexttrack', () => handlers.onNext());

	safeSet('seekbackward', (details) => {
		const offset = details.seekOffset ?? 10;
		handlers.onSeekBackward?.(offset);
	});

	safeSet('seekforward', (details) => {
		const offset = details.seekOffset ?? 10;
		handlers.onSeekForward?.(offset);
	});

	safeSet('seekto', (details) => {
		if (details.seekTime != null) {
			handlers.onSeekTo?.(details.seekTime);
		}
	});

	safeSet('stop', () => handlers.onStop?.());
}
