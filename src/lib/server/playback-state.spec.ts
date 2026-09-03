import { describe, expect, it } from 'vitest';
import {
	EMPTY_PLAYBACK_STATE,
	MAX_PLAYBACK_HISTORY_LENGTH,
	MAX_PLAYBACK_QUEUE_LENGTH,
	parsePlaybackState
} from './playback-state';

const track = {
	kind: 'track',
	id: '123',
	title: 'A track',
	artists: [{ id: '456', name: 'An artist' }],
	duration: 210
};

describe('playback state', () => {
	it('accepts a bounded resume state', () => {
		expect(
			parsePlaybackState({ currentTrack: track, queue: [track], history: [], currentTime: 42 })
		).toEqual({ currentTrack: track, queue: [track], history: [], currentTime: 42 });
	});

	it('rejects malformed tracks and oversized workflow lists', () => {
		expect(
			parsePlaybackState({
				currentTrack: { ...track, artists: [] },
				queue: [],
				history: [],
				currentTime: 0
			})
		).toBeNull();
		expect(
			parsePlaybackState({
				currentTrack: null,
				queue: Array.from({ length: MAX_PLAYBACK_QUEUE_LENGTH + 1 }, () => track),
				history: [],
				currentTime: 0
			})
		).toBeNull();
		expect(
			parsePlaybackState({
				currentTrack: null,
				queue: [],
				history: Array.from({ length: MAX_PLAYBACK_HISTORY_LENGTH + 1 }, () => track),
				currentTime: 0
			})
		).toBeNull();
	});

	it('keeps an explicit empty state', () => {
		expect(parsePlaybackState(EMPTY_PLAYBACK_STATE)).toEqual(EMPTY_PLAYBACK_STATE);
	});
});
