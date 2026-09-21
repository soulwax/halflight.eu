import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PlaybackSessionCoordinator,
	type SavedPlaybackState,
	type PlaybackPersistenceStatus,
	type PlaybackDeviceStatus
} from './session-coordinator.js';
import type { TrackSummary } from '#lib/tidal/models.js';
import type { QueueEntry } from './queue-entry.js';
import type { QueueCommand } from './playback-reconciliation.js';

const sampleTrack1: TrackSummary = {
	kind: 'track',
	id: 'track-1',
	title: 'Track One',
	artists: [{ id: 'artist-1', name: 'Artist 1' }]
};

const sampleTrack2: TrackSummary = {
	kind: 'track',
	id: 'track-2',
	title: 'Track Two',
	artists: [{ id: 'artist-2', name: 'Artist 2' }]
};

const sampleTrack3: TrackSummary = {
	kind: 'track',
	id: 'track-3',
	title: 'Track Three',
	artists: [{ id: 'artist-3', name: 'Artist 3' }]
};

function makeEntry(track: TrackSummary, entryId: string): QueueEntry {
	return { ...track, entryId };
}

describe('PlaybackSessionCoordinator', () => {
	let appliedQueue: QueueEntry[];
	let appliedSession: SavedPlaybackState | null;
	let statusHistory: PlaybackPersistenceStatus[];
	let activeDevice: PlaybackDeviceStatus | null;
	let hydratedTracks: TrackSummary[];
	let currentState: {
		currentTrack: TrackSummary | null;
		queue: QueueEntry[];
		history: TrackSummary[];
		currentTime: number;
		isPlaying: boolean;
		hasLocalMedia: boolean;
	};

	beforeEach(() => {
		appliedQueue = [];
		appliedSession = null;
		statusHistory = [];
		activeDevice = null;
		hydratedTracks = [];
		currentState = {
			currentTrack: null,
			queue: [],
			history: [],
			currentTime: 0,
			isPlaying: false,
			hasLocalMedia: false
		};
	});

	function createCoordinator(
		fetchMock: typeof fetch,
		options: {
			canPersist?: () => boolean;
			onQueueCommandsChange?: (commands: readonly QueueCommand[]) => void;
		} = {}
	) {
		return new PlaybackSessionCoordinator({
			origin: 'listening-room',
			fetch: fetchMock,
			debounceMs: 10,
			getCurrentState: () => currentState,
			onApplyQueue: (q) => {
				appliedQueue = q;
				currentState.queue = q;
			},
			onApplySession: (s) => {
				appliedSession = s;
			},
			onStatusChange: (s) => {
				statusHistory.push(s);
			},
			onActiveDeviceChange: (d) => {
				activeDevice = d;
			},
			onHydrateMetadata: (t) => {
				hydratedTracks = t;
			},
			onQueueCommandsChange: options.onQueueCommandsChange,
			canPersist: options.canPersist
		});
	}

	it('buffers queue commands and sends them via /api/playback-state/intents', async () => {
		const calls: Array<{ url: string; body: any }> = [];
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			const body = init?.body ? JSON.parse(String(init.body)) : null;
			calls.push({ url: String(url), body });
			if (String(url) === '/api/playback-state/intents') {
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [makeEntry(sampleTrack1, 'entry-1')],
						history: [],
						currentTime: 0,
						revision: 1
					}),
					{ status: 200 }
				);
			}
			if (String(url) === '/api/playback-state') {
				return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-1')]
		});

		expect(coordinator.status).toBe('saving');
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));

		const intentCall = calls.find((c) => c.url === '/api/playback-state/intents');
		expect(intentCall).toBeDefined();
		expect(intentCall?.body).toMatchObject({
			version: 2,
			expectedRevision: 0,
			origin: 'listening-room',
			intent: {
				type: 'queue.append',
				entries: [expect.objectContaining({ id: 'track-1', entryId: 'entry-1' })]
			}
		});
		expect(coordinator.revision).toBe(2);
		expect(coordinator.queueCommands).toHaveLength(0);
	});

	it('writes a durable command journal before dispatch and clears it after acknowledgement', async () => {
		const journals: Array<readonly QueueCommand[]> = [];
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/intents') {
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [makeEntry(sampleTrack1, 'entry-1')],
						history: [],
						currentTime: 0,
						revision: 1
					}),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock, {
			onQueueCommandsChange: (commands) =>
				journals.push(commands.map((command) => ({ ...command })))
		});
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-1')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
		expect(journals.some(([command]) => Boolean(command?.operationId))).toBe(true);
		expect(journals.at(-1)).toEqual([]);
	});

	it('flushes a debounced queue write immediately at a navigation boundary', async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/intents') {
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [makeEntry(sampleTrack1, 'entry-1')],
						history: [],
						currentTime: 0,
						revision: 1
					}),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
		});
		const coordinator = createCoordinator(fetchMock as typeof fetch);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-1')]
		});

		coordinator.flushPersistence();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/playback-state/intents');
	});

	it('rebases on a single 409 conflict and retries successfully', async () => {
		let intentCalls = 0;
		const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
			const urlStr = String(url);
			if (urlStr === '/api/playback-state/intents') {
				intentCalls += 1;
				if (intentCalls === 1) {
					return new Response(
						JSON.stringify({
							currentTrack: null,
							queue: [makeEntry(sampleTrack2, 'entry-remote')],
							history: [],
							currentTime: 0,
							revision: 5
						}),
						{ status: 409 }
					);
				}
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [
							makeEntry(sampleTrack2, 'entry-remote'),
							makeEntry(sampleTrack1, 'entry-local')
						],
						history: [],
						currentTime: 0,
						revision: 6
					}),
					{ status: 200 }
				);
			}
			if (urlStr === '/api/playback-state') {
				return new Response(JSON.stringify({ revision: 7 }), { status: 200 });
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
		expect(intentCalls).toBe(2);
		expect(appliedQueue.map((e) => e.id)).toEqual(['track-2', 'track-1']);
		expect(coordinator.revision).toBe(7);
	});

	it('stops and enters conflict state on repeated 409 responses', async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/intents') {
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [makeEntry(sampleTrack2, 'entry-remote')],
						history: [],
						currentTime: 0,
						revision: 10
					}),
					{ status: 409 }
				);
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('conflict'));
		// Commands remain intact so user does not lose their edit
		expect(coordinator.queueCommands).toHaveLength(1);
	});

	it('refreshes queue from server when recovering from conflict state', async () => {
		let intentCalls = 0;
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			const urlStr = String(url);
			if (urlStr === '/api/playback-state' && (!init?.method || init.method === 'GET')) {
				return new Response(
					JSON.stringify({
						currentTrack: sampleTrack3,
						queue: [makeEntry(sampleTrack2, 'entry-remote-2')],
						history: [],
						currentTime: 15,
						revision: 20
					}),
					{ status: 200 }
				);
			}
			if (urlStr === '/api/playback-state/intents') {
				intentCalls += 1;
				return new Response(
					JSON.stringify({
						currentTrack: sampleTrack3,
						queue: [
							makeEntry(sampleTrack2, 'entry-remote-2'),
							makeEntry(sampleTrack1, 'entry-local')
						],
						history: [],
						currentTime: 15,
						revision: 21
					}),
					{ status: 200 }
				);
			}
			if (urlStr === '/api/playback-state') {
				return new Response(JSON.stringify({ revision: 22 }), { status: 200 });
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.status = 'conflict';
		coordinator.queueCommands = [
			{ type: 'append', entries: [makeEntry(sampleTrack1, 'entry-local')] }
		];

		await coordinator.refreshQueueFromServer();

		expect(intentCalls).toBe(1);
		expect(coordinator.status).toBe('saved');
		expect(coordinator.revision).toBe(22);
		expect(appliedQueue.map((e) => e.id)).toEqual(['track-2', 'track-1']);
	});

	it('drops a permanently-inapplicable command instead of retrying it forever', async () => {
		// The server's `400` here means "this operation can never apply" (e.g. a
		// remove naming an entryId another device already removed) — distinct
		// from a `409` conflict, which is retryable, and from a network failure,
		// which is `offline`. Before the fix this fell into `!response.ok` and was
		// treated exactly like `offline`: the command stayed at the head of the
		// buffer and was resent, unchanged, on every future attempt, blocking
		// every command queued behind it forever.
		let intentCalls = 0;
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/intents') {
				intentCalls += 1;
				if (intentCalls === 1) {
					// The first command (remove) can never apply.
					return new Response(
						JSON.stringify({
							currentTrack: null,
							queue: [makeEntry(sampleTrack2, 'entry-remote')],
							history: [],
							currentTime: 0,
							revision: 9
						}),
						{ status: 400 }
					);
				}
				// The second command (append), sent immediately after the drop.
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [
							makeEntry(sampleTrack2, 'entry-remote'),
							makeEntry(sampleTrack1, 'entry-local')
						],
						history: [],
						currentTime: 0,
						revision: 10
					}),
					{ status: 200 }
				);
			}
			if (String(url) === '/api/playback-state') {
				return new Response(JSON.stringify({ revision: 10 }), { status: 200 });
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({ type: 'remove', entryId: 'entry-already-gone' });
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		// The batch as a whole still ends 'rejected', not 'saved': the append did
		// land, but silently reporting 'saved' would erase the only signal that
		// the remove ahead of it did not. It is informational, not blocking —
		// unlike 'conflict' it does not hold up the next persistence cycle.
		await vi.waitFor(() => expect(coordinator.status).toBe('rejected'));
		expect(intentCalls).toBe(2);
		// The un-appliable remove is gone; the append behind it still landed.
		expect(coordinator.queueCommands).toHaveLength(0);
		expect(appliedQueue.map((e) => e.id)).toEqual(['track-2', 'track-1']);
		expect(coordinator.revision).toBe(10);

		// A later, clean cycle clears it — the same way 'offline' clears on the
		// next success, rather than needing an explicit dismissal.
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack3, 'entry-local-2')]
		});
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
	});

	it('reports the drop even when only the rejected command was queued', async () => {
		// With nothing behind it, the snapshot write that follows would normally
		// report `'saved'` — which is true of that write in isolation, but would
		// silently erase the one signal that an edit was discarded, moments after
		// it appeared.
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/intents') {
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [],
						history: [],
						currentTime: 0,
						revision: 3
					}),
					{ status: 400 }
				);
			}
			if (String(url) === '/api/playback-state') {
				return new Response(JSON.stringify({ revision: 3 }), { status: 200 });
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({ type: 'remove', entryId: 'entry-already-gone' });

		await vi.waitFor(() => expect(coordinator.status).toBe('rejected'));
		expect(coordinator.queueCommands).toHaveLength(0);
	});

	it('marks status offline on network failure and preserves buffered commands', async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error('network down');
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('offline'));
		expect(coordinator.queueCommands).toHaveLength(1);
	});

	it('distinguishes an ended session from a network drop when sending a queue command', async () => {
		// A 401's body never parses as a SavedPlaybackState, so without checking
		// the status first this fell into the same branch as a malformed response
		// and was reported as 'offline' — "check your connection" is wrong advice
		// for a session that has actually ended.
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ message: 'Unauthorized' }), {
					status: 401
				})
		) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('unauthenticated'));
		// The edit is not lost — it can be sent again once the owner signs back in.
		expect(coordinator.queueCommands).toHaveLength(1);
	});

	it('distinguishes an ended session from a network drop when saving the snapshot', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ message: 'Unauthorized' }), {
					status: 401
				})
		) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.schedulePersistence();

		await vi.waitFor(() => expect(coordinator.status).toBe('unauthenticated'));
	});

	it('distinguishes an ended session from a network drop when refreshing after a conflict', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ message: 'Unauthorized' }), {
					status: 401
				})
		) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.status = 'conflict';

		await coordinator.refreshQueueFromServer();

		expect(coordinator.status).toBe('unauthenticated');
	});

	it('surfaces a session that ended while only the background poll was running', async () => {
		// Before this fix, `syncPlaybackState`'s failure path changed nothing the
		// UI could observe: `sessionSyncFailures` incremented and the function
		// returned, silently. The owner would see their queue simply stop syncing
		// for good, with no indication why — the worst case, since every other
		// call site at least reported 'offline'.
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ message: 'Unauthorized' }), {
					status: 401
				})
		) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		await coordinator.syncPlaybackState();

		expect(coordinator.status).toBe('unauthenticated');
	});

	it('clears the unauthenticated status once the background poll succeeds again', async () => {
		// The same recovery path 'offline' already had — signing back in (in this
		// tab or another) should not require an extra dismissal.
		let authenticated = false;
		const fetchMock = vi.fn(async () => {
			if (!authenticated) {
				return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
			}
			return new Response(
				JSON.stringify({
					currentTrack: null,
					queue: [],
					history: [],
					currentTime: 0,
					revision: 1
				}),
				{ status: 200 }
			);
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		await coordinator.syncPlaybackState();
		expect(coordinator.status).toBe('unauthenticated');

		authenticated = true;
		await coordinator.syncPlaybackState();
		expect(coordinator.status).toBe('saved');
	});

	it('respects canPersist guard before initiating persistence', async () => {
		const fetchMock = vi.fn() as typeof fetch;
		let allowed = false;
		const coordinator = createCoordinator(fetchMock, { canPersist: () => allowed });

		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		// Debounce time passes
		await new Promise((r) => setTimeout(r, 30));
		expect(fetchMock).not.toHaveBeenCalled();

		allowed = true;
		coordinator.schedulePersistence();
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
	});

	it('syncPlaybackState updates session when idle and preserves audible track when playing', async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					currentTrack: sampleTrack2,
					queue: [makeEntry(sampleTrack3, 'entry-3')],
					history: [],
					currentTime: 42,
					revision: 8
				}),
				{ status: 200 }
			);
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);

		// Case A: idle - session is applied
		currentState.isPlaying = false;
		currentState.hasLocalMedia = false;
		await coordinator.syncPlaybackState();

		expect(appliedSession?.currentTrack?.id).toBe('track-2');
		expect(appliedQueue.map((e) => e.id)).toEqual(['track-3']);
		expect(hydratedTracks.map((e) => e.id)).toEqual(['track-3']);
		expect(coordinator.revision).toBe(8);

		// Case B: playing - audible track is preserved, only queue updates
		appliedSession = null;
		currentState.isPlaying = true;
		currentState.currentTrack = sampleTrack1;
		currentState.hasLocalMedia = true;

		(fetchMock as any).mockImplementationOnce(async () => {
			return new Response(
				JSON.stringify({
					currentTrack: sampleTrack3,
					queue: [makeEntry(sampleTrack1, 'entry-1')],
					history: [],
					currentTime: 99,
					revision: 9
				}),
				{ status: 200 }
			);
		});

		await coordinator.syncPlaybackState();
		expect(appliedSession).toBeNull(); // Did not overwrite now-playing
		expect(appliedQueue.map((e) => e.id)).toEqual(['track-1']);
		expect(coordinator.revision).toBe(9);
	});

	it('claims playback control and updates active device status', async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/claim') {
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [],
						history: [],
						currentTime: 0,
						revision: 3,
						activeDevice: {
							origin: 'listening-room',
							expiresAt: new Date(Date.now() + 60_000).toISOString(),
							isCurrent: true
						}
					}),
					{ status: 200 }
				);
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = new PlaybackSessionCoordinator({
			origin: 'listening-room',
			fetch: fetchMock,
			getDeviceId: () => 'dev-123',
			getCurrentState: () => currentState,
			onApplyQueue: (q) => {
				appliedQueue = q;
			},
			onActiveDeviceChange: (d) => {
				activeDevice = d;
			}
		});

		const claimed = await coordinator.takePlaybackControl();
		expect(claimed).toBe(true);
		expect(activeDevice).toMatchObject({
			origin: 'listening-room',
			isCurrent: true
		});
	});
});
