import { describe, expect, it } from 'vitest';
import { PlaybackSessionCoordinator, type SavedPlaybackState } from './session-coordinator.js';
import type { TrackSummary } from '#lib/tidal/models.js';
import type { QueueEntry } from './queue-entry.js';
import { rebaseQueue } from './playback-reconciliation.js';

function makeTrack(id: string, title: string): TrackSummary {
	return {
		kind: 'track',
		id,
		title,
		artists: [{ id: `artist-${id}`, name: `Artist ${id}` }]
	};
}

function makeEntry(track: TrackSummary, entryId: string): QueueEntry {
	return { ...track, entryId };
}

/**
 * In-memory mock server implementing the /api/playback-state and /api/playback-state/intents
 * optimistic concurrency contracts with revision checks and operation idempotency.
 */
class MockPlaybackServer {
	state: SavedPlaybackState & { revision: number };
	processedOperations = new Map<string, { revision: number; queue: QueueEntry[] }>();

	constructor(initialQueue: QueueEntry[] = [], initialTrack: TrackSummary | null = null) {
		this.state = {
			currentTrack: initialTrack,
			queue: initialQueue,
			history: [],
			currentTime: 0,
			revision: 1
		};
	}

	createFetch(): typeof fetch {
		return (async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method?.toUpperCase() ?? 'GET';

			if (url === '/api/playback-state' && method === 'GET') {
				return new Response(JSON.stringify(this.state), { status: 200 });
			}

			if (url === '/api/playback-state/intents' && method === 'POST') {
				const body = JSON.parse(String(init?.body));
				const { expectedRevision, operationId, intent } = body;

				// Check idempotency
				if (operationId && this.processedOperations.has(operationId)) {
					return new Response(
						JSON.stringify({
							...this.state,
							queue: this.processedOperations.get(operationId)!.queue,
							revision: this.processedOperations.get(operationId)!.revision
						}),
						{ status: 200 }
					);
				}

				// Check revision
				if (expectedRevision !== this.state.revision) {
					return new Response(JSON.stringify(this.state), { status: 409 });
				}

				// Apply intent
				let nextQueue = [...this.state.queue];
				if (intent.type === 'queue.append') {
					nextQueue.push(...intent.entries);
				} else if (intent.type === 'queue.remove') {
					nextQueue = nextQueue.filter((e) => e.entryId !== intent.entryId);
				} else if (intent.type === 'queue.replace') {
					nextQueue = intent.entries.slice();
				}

				this.state.revision += 1;
				this.state.queue = nextQueue;
				if (operationId) {
					this.processedOperations.set(operationId, {
						revision: this.state.revision,
						queue: nextQueue
					});
				}

				return new Response(JSON.stringify(this.state), { status: 200 });
			}

			if (url === '/api/playback-state' && method === 'PUT') {
				const body = JSON.parse(String(init?.body));
				if (body.revision !== this.state.revision) {
					return new Response(JSON.stringify(this.state), { status: 409 });
				}
				this.state.revision += 1;
				this.state.queue = body.queue ?? this.state.queue;
				this.state.currentTime = body.currentTime ?? this.state.currentTime;
				this.state.currentTrack = body.currentTrack ?? this.state.currentTrack;
				return new Response(JSON.stringify({ revision: this.state.revision }), { status: 200 });
			}

			return new Response(null, { status: 404 });
		}) as typeof fetch;
	}
}

describe('Multi-Client Queue Race and Invariant Reconciliation', () => {
	it('preserves an append from Client A while Client B concurrently removes a track with 409 rebase', async () => {
		const track1 = makeTrack('1', 'Track 1');
		const track2 = makeTrack('2', 'Track 2');
		const track3 = makeTrack('3', 'Track 3');
		const track4 = makeTrack('4', 'Track 4');

		const initialQueue = [
			makeEntry(track1, 'entry-1'),
			makeEntry(track2, 'entry-2'),
			makeEntry(track3, 'entry-3')
		];

		const server = new MockPlaybackServer(initialQueue);

		// Client A: Listening Room
		let clientAQueue = [...initialQueue];
		const coordinatorA = new PlaybackSessionCoordinator({
			origin: 'listening-room',
			fetch: server.createFetch(),
			debounceMs: 5,
			getCurrentState: () => ({
				currentTrack: null,
				queue: clientAQueue,
				history: [],
				currentTime: 0,
				isPlaying: false,
				hasLocalMedia: false
			}),
			onApplyQueue: (q) => {
				clientAQueue = q;
			}
		});
		coordinatorA.revision = 1;

		// Client B: Halflight Now (actively playing an audible track)
		const nowPlayingTrackB = makeTrack('now', 'Playing Now');
		let clientBQueue = [...initialQueue];
		let clientBNowPlaying: TrackSummary | null = nowPlayingTrackB;
		const coordinatorB = new PlaybackSessionCoordinator({
			origin: 'halflight-now',
			fetch: server.createFetch(),
			debounceMs: 5,
			getCurrentState: () => ({
				currentTrack: clientBNowPlaying,
				queue: clientBQueue,
				history: [],
				currentTime: 35,
				isPlaying: true,
				hasLocalMedia: true
			}),
			onApplyQueue: (q) => {
				clientBQueue = q;
			},
			onApplySession: (s) => {
				// Should not be called while playing
				clientBNowPlaying = s.currentTrack;
			}
		});
		coordinatorB.revision = 1;

		// 1. Client A appends Track 4
		const newEntryA = makeEntry(track4, 'entry-4');
		clientAQueue.push(newEntryA);
		coordinatorA.recordCommand({
			type: 'append',
			entries: [newEntryA]
		});

		// 2. Concurrently, Client B removes Track 2 (entry-2) using stale rev 1
		clientBQueue = clientBQueue.filter((e) => e.entryId !== 'entry-2');
		coordinatorB.recordCommand({
			type: 'remove',
			entryId: 'entry-2'
		});

		// 3. Wait for Client A to persist to server
		// Client A persists first -> revision advances to 2, server queue has 1, 2, 3, 4
		await coordinatorA.persistPlaybackState();
		expect(server.state.revision).toBe(3); // +1 from intent, +1 from PUT
		expect(server.state.queue.map((e) => e.id)).toEqual(['1', '2', '3', '4']);

		// 4. Client B persists with expectedRevision: 1 -> receives 409 from server!
		// Coordinator B rebases remove('entry-2') on server's queue [1, 2, 3, 4] -> [1, 3, 4]
		// Retries with expectedRevision: 3 -> succeeds!
		await coordinatorB.persistPlaybackState();

		// Invariant checks:
		// 1. Client B's removal succeeded and Client A's addition was preserved!
		expect(server.state.queue.map((e) => e.id)).toEqual(['1', '3', '4']);
		expect(clientBQueue.map((e) => e.id)).toEqual(['1', '3', '4']);

		// 2. Client B's music was NEVER stopped or replaced
		expect(clientBNowPlaying?.id).toBe('now');

		// 3. Client A syncs to server state
		await coordinatorA.syncPlaybackState();
		expect(clientAQueue.map((e) => e.id)).toEqual(['1', '3', '4']);
		expect(coordinatorA.revision).toBe(server.state.revision);
		expect(coordinatorB.revision).toBe(server.state.revision);
	});

	it('ensures operation retries with identical operationId are idempotent on server', async () => {
		const track1 = makeTrack('1', 'Track 1');
		const track2 = makeTrack('2', 'Track 2');
		const server = new MockPlaybackServer([makeEntry(track1, 'entry-1')]);

		const fetchFn = server.createFetch();
		const opId = 'test-op-123';

		// First submission
		const res1 = await fetchFn('/api/playback-state/intents', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				version: 2,
				expectedRevision: 1,
				operationId: opId,
				origin: 'listening-room',
				intent: {
					type: 'queue.append',
					entries: [makeEntry(track2, 'entry-2')]
				}
			})
		});
		expect(res1.status).toBe(200);
		expect(server.state.queue.map((e) => e.id)).toEqual(['1', '2']);
		const revAfterFirst = server.state.revision;

		// Replay submission with same operationId (e.g. retried after connection drop)
		const res2 = await fetchFn('/api/playback-state/intents', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				version: 2,
				expectedRevision: 1, // Stale expected revision
				operationId: opId,
				origin: 'listening-room',
				intent: {
					type: 'queue.append',
					entries: [makeEntry(track2, 'entry-2')]
				}
			})
		});
		expect(res2.status).toBe(200);
		// Queue did NOT duplicate Track 2
		expect(server.state.queue.map((e) => e.id)).toEqual(['1', '2']);
		expect(server.state.revision).toBe(revAfterFirst);
	});
});
