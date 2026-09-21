import { describe, expect, it } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';
import { createQueueEntry } from '#lib/player/queue-entry.js';
import {
	EMPTY_PLAYBACK_STATE,
	MAX_PLAYBACK_HISTORY_LENGTH,
	applyQueueIntent,
	parsePlaybackState,
	parsePlaybackDeviceId,
	parsePlaybackIntent,
	parsePlaybackStateOrigin,
	parsePlaybackStateRevision,
	playbackIntentFingerprint,
	savePlaybackState,
	claimPlaybackDevice,
	type PlaybackIntent,
	type PlaybackState,
	type PlaybackDeviceLeaseStore,
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
				persisted = { ...nextState, revision, lastOrigin: origin, activeDevice: null };
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
				currentTrack: { ...track, artists: 'not-an-array' },
				queue: [],
				history: [],
				currentTime: 0
			})
		).toBeNull();
	});

	it('accepts artist-less legacy tracks in a queue replacement', () => {
		const legacyTrack = { ...track, artists: [] };
		const intent = parsePlaybackIntent({
			version: 2,
			expectedRevision: 4,
			operationId: 'operation-legacy-playlist',
			origin: 'listening-room',
			intent: {
				type: 'queue.replace',
				entries: [{ ...legacyTrack, entryId: 'entry-legacy-track' }]
			}
		});

		expect(intent).toMatchObject({
			intent: {
				type: 'queue.replace',
				entries: [expect.objectContaining({ id: track.id, artists: [] })]
			}
		});
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

	it('accepts only bounded opaque browser device identifiers', () => {
		expect(parsePlaybackDeviceId('device_123456789')).toBe('device_123456789');
		expect(parsePlaybackDeviceId('owner@example.com')).toBeNull();
		expect(parsePlaybackDeviceId('device_short')).toBeNull();
	});

	it('claims a lease only through the injected authoritative store', async () => {
		const claimed: PlaybackState = {
			...EMPTY_PLAYBACK_STATE,
			revision: 4,
			lastOrigin: 'halflight-now',
			activeDevice: {
				origin: 'halflight-now',
				expiresAt: '2026-09-08T00:00:45.000Z',
				isCurrent: true
			}
		};
		const store: PlaybackDeviceLeaseStore = {
			claim: async (userId, deviceId, origin) => {
				expect([userId, deviceId, origin]).toEqual([
					'owner-1',
					'device_123456789',
					'halflight-now'
				]);
				return claimed;
			}
		};

		await expect(
			claimPlaybackDevice('owner-1', 'device_123456789', 'halflight-now', store)
		).resolves.toEqual(claimed);
	});

	it('requires stable entry IDs for queue intents while retaining duplicate track occurrences', () => {
		const first = { ...track, entryId: 'entry-first' };
		const second = { ...track, entryId: 'entry-second' };
		const intent = parsePlaybackIntent({
			version: 2,
			expectedRevision: 4,
			operationId: 'operation-1',
			origin: 'halflight-now',
			intent: { type: 'queue.remove', entryId: 'entry-second' }
		});

		expect(intent).toMatchObject({
			expectedRevision: 4,
			origin: 'halflight-now',
			intent: { type: 'queue.remove', entryId: 'entry-second' }
		});
		expect(
			applyQueueIntent([first, second], intent!.intent)?.map((entry) => entry.entryId)
		).toEqual(['entry-first']);
		expect(
			parsePlaybackIntent({
				version: 2,
				expectedRevision: 4,
				operationId: 'operation-2',
				origin: 'halflight-now',
				intent: { type: 'queue.append', entries: [track] }
			})
		).toBeNull();
	});

	it('does not apply an intent that reuses an existing entry identity', () => {
		const existing = { ...track, entryId: 'entry-existing' };
		const duplicate = { ...track, entryId: 'entry-existing' };

		expect(applyQueueIntent([existing], { type: 'queue.append', entries: [duplicate] })).toBeNull();
	});

	describe('playbackIntentFingerprint', () => {
		function intent(overrides: Partial<PlaybackIntent> = {}): PlaybackIntent {
			return {
				version: 2,
				expectedRevision: 5,
				operationId: 'operation-1',
				origin: 'listening-room',
				intent: { type: 'queue.append', entries: [queued] },
				...overrides
			};
		}

		it('is stable across a retry that carries a different expectedRevision', () => {
			// This is the retry `persistQueueCommands` sends after a lost response:
			// same operation, but the client has since learned a newer revision and
			// rebased onto it before resending. The two must fingerprint identically
			// or the dedup lookup in `dbPlaybackIntentStore.apply` never matches, and
			// an already-applied operation is rejected a second time as `invalid`.
			expect(playbackIntentFingerprint(intent({ expectedRevision: 5 }))).toBe(
				playbackIntentFingerprint(intent({ expectedRevision: 6 }))
			);
		});

		it('changes when the intent content differs', () => {
			const append = playbackIntentFingerprint(intent());
			const clear = playbackIntentFingerprint(intent({ intent: { type: 'queue.clear' } }));
			expect(append).not.toBe(clear);
		});

		it('changes when origin or device differ, even for an identical intent', () => {
			const base = playbackIntentFingerprint(intent());
			expect(playbackIntentFingerprint(intent({ origin: 'halflight-now' }))).not.toBe(base);
			expect(playbackIntentFingerprint(intent({ deviceId: 'device-a' }))).not.toBe(base);
			expect(playbackIntentFingerprint(intent({ deviceId: 'device-a' }))).not.toBe(
				playbackIntentFingerprint(intent({ deviceId: 'device-b' }))
			);
		});

		it('does not depend on operationId', () => {
			// operationId is already the lookup key in `apply()`; folding it into the
			// hash too would be redundant, not incorrect, but keeping it out keeps the
			// fingerprint's job legible: "is this the same request", not "same id".
			expect(playbackIntentFingerprint(intent({ operationId: 'operation-1' }))).toBe(
				playbackIntentFingerprint(intent({ operationId: 'operation-2' }))
			);
		});
	});
});
