import { describe, expect, it } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';
import { createQueueEntry } from '#lib/player/queue-entry.js';
import {
	EMPTY_PLAYBACK_STATE,
	MAX_PLAYBACK_HISTORY_LENGTH,
	parsePlaybackState,
	parsePlaybackStateOrigin,
	parsePlaybackStateRevision,
	savePlaybackState,
	type PlaybackState,
	type PlaybackStateInput,
	type PlaybackStateStore
} from './playback-state';

const track: TrackSummary = {
	kind: 'track',
	id: '123',
	title: 'A track',
	artists: [{ id: '456', name: 'An artist' }],
	duration: 210
};

const queued = createQueueEntry(track);
const asQueued = (t: TrackSummary) =>
	expect.objectContaining({ ...t, entryId: expect.any(String) });

describe('playback state', () => {
	it('accepts only one of two simultaneous writes for the same revision', async () => {
		let persisted: PlaybackState = { ...EMPTY_PLAYBACK_STATE };
		const acceptedRevisions: number[] = [];
		const store: PlaybackStateStore = {
			read: async () => persisted,
			write: async (_userId, nextState, expectedRevision, origin) => {
				if (persisted.revision !== expectedRevision) return null;
				const revision = expectedRevision + 1;
				acceptedRevisions.push(revision);
				persisted = { ...nextState, revision, lastOrigin: origin };
				return persisted;
			}
		};
		const first: PlaybackStateInput = {
			currentTrack: null,
			queue: [queued],
			history: [],
			currentTime: 12
		};
		const second: PlaybackStateInput = {
			currentTrack: null,
			queue: [],
			history: [track],
			currentTime: 34
		};

		const [firstResult, secondResult] = await Promise.all([
			savePlaybackState('owner-1', first, 0, 'listening-room', store),
			savePlaybackState('owner-1', second, 0, 'halflight-now', store)
		]);

		expect(acceptedRevisions).toEqual([1]);
		expect([firstResult.conflict, secondResult.conflict]).toEqual([false, true]);
		expect(secondResult.state).toEqual(firstResult.state);
		expect(secondResult.state).toMatchObject({ revision: 1, queue: [track], currentTime: 12 });
	});

	it('accepts a bounded resume state', () => {
		expect(
			parsePlaybackState({ currentTrack: track, queue: [track], history: [], currentTime: 42 })
		).toEqual({ currentTrack: track, queue: [asQueued(track)], history: [], currentTime: 42 });
	});

	it('rejects a malformed current track but not the whole request', () => {
		expect(
			parsePlaybackState({
				currentTrack: { ...track, artists: [] },
				queue: [],
				history: [],
				currentTime: 0
			})
		).toBeNull();
	});

	it('drops unparseable queue entries and caps oversized lists instead of rejecting', () => {
		const bad = { kind: 'track', id: 'x', title: 'x' }; // no artists
		const state = parsePlaybackState({
			currentTrack: null,
			queue: [track, bad, track],
			history: Array.from({ length: MAX_PLAYBACK_HISTORY_LENGTH + 10 }, () => track),
			currentTime: 0
		});
		expect(state).not.toBeNull();
		expect(state?.queue).toEqual([asQueued(track), asQueued(track)]);
		expect(state?.queue.every((entry) => typeof entry.entryId === 'string')).toBe(true);
		expect(state?.history).toHaveLength(MAX_PLAYBACK_HISTORY_LENGTH);
	});

	it('still rejects a fundamentally wrong shape', () => {
		expect(
			parsePlaybackState({ currentTrack: null, queue: 'nope', history: [], currentTime: 0 })
		).toBeNull();
	});

	it('accepts a snapshot with valid entry-id queue commands but rejects unknown ones', () => {
		expect(
			parsePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 })
		).toEqual({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		expect(
			parsePlaybackState({
				currentTrack: null,
				queue: [],
				history: [],
				currentTime: 0,
				queueCommands: [{ type: 'append', entries: [queued] }]
			})
		).toEqual({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		expect(
			parsePlaybackState({
				currentTrack: null,
				queue: [],
				history: [],
				currentTime: 0,
				queueCommands: [{ type: 'unknown-command' }]
			})
		).toBeNull();
	});

	it('keeps an explicit empty state', () => {
		expect(parsePlaybackState(EMPTY_PLAYBACK_STATE)).toEqual({
			currentTrack: null,
			queue: [],
			history: [],
			currentTime: 0
		});
	});

	it('accepts only known product origins and non-negative integer revisions', () => {
		expect(parsePlaybackStateOrigin('listening-room')).toBe('listening-room');
		expect(parsePlaybackStateOrigin('other-site')).toBeNull();
		expect(parsePlaybackStateRevision(12)).toBe(12);
		expect(parsePlaybackStateRevision(-1)).toBeNull();
		expect(parsePlaybackStateRevision(1.5)).toBeNull();
	});
});
