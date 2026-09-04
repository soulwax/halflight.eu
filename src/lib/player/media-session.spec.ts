import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	setupMediaSessionHandlers,
	updateMediaMetadata,
	updatePlaybackState,
	updatePositionState
} from './media-session.js';
import type { TrackSummary } from '#lib/tidal/models.js';

describe('media-session.ts', () => {
	let mockMediaSession: {
		metadata: MediaMetadata | null;
		playbackState: string;
		setActionHandler: ReturnType<typeof vi.fn>;
		setPositionState: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockMediaSession = {
			metadata: null,
			playbackState: 'none',
			setActionHandler: vi.fn(),
			setPositionState: vi.fn()
		};

		vi.stubGlobal('navigator', {
			mediaSession: mockMediaSession
		});

		// Mock MediaMetadata constructor
		vi.stubGlobal(
			'MediaMetadata',
			class MockMediaMetadata {
				title: string;
				artist: string;
				album: string;
				artwork: MediaImage[];
				constructor(init: { title: string; artist: string; album: string; artwork: MediaImage[] }) {
					this.title = init.title;
					this.artist = init.artist;
					this.album = init.album;
					this.artwork = init.artwork;
				}
			}
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('updates metadata with track title, artists, album, and artwork sizes', () => {
		const track: TrackSummary = {
			kind: 'track',
			id: 'track-42',
			title: 'Blue in Green',
			artists: [{ id: 'a1', name: 'Miles Davis' }],
			album: { id: 'alb1', title: 'Kind of Blue', imageUrl: 'https://img.test/cover.jpg' }
		};

		updateMediaMetadata(track);

		expect(mockMediaSession.metadata).not.toBeNull();
		expect(mockMediaSession.metadata?.title).toBe('Blue in Green');
		expect(mockMediaSession.metadata?.artist).toBe('Miles Davis');
		expect(mockMediaSession.metadata?.album).toBe('Kind of Blue');
		expect(mockMediaSession.metadata?.artwork.length).toBeGreaterThan(0);
	});

	it('clears metadata when null is passed', () => {
		updateMediaMetadata(null);
		expect(mockMediaSession.metadata).toBeNull();
	});

	it('updates playback state to playing and paused', () => {
		updatePlaybackState(true);
		expect(mockMediaSession.playbackState).toBe('playing');

		updatePlaybackState(false);
		expect(mockMediaSession.playbackState).toBe('paused');
	});

	it('reports position and duration telemetry to setPositionState', () => {
		updatePositionState({ duration: 240, position: 120 });
		expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
			duration: 240,
			position: 120,
			playbackRate: 1
		});
	});

	it('registers action handlers for play, pause, previous, next, seek', () => {
		const handlers = {
			onPlay: vi.fn(),
			onPause: vi.fn(),
			onPrevious: vi.fn(),
			onNext: vi.fn()
		};

		setupMediaSessionHandlers(handlers);

		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith(
			'previoustrack',
			expect.any(Function)
		);
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith(
			'nexttrack',
			expect.any(Function)
		);
	});
});
