import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	const coordinators = new Set<PlaybackSessionCoordinator>();
	afterEach(() => {
		for (const coordinator of coordinators) {
			coordinator.cancelPendingPersistence();
			coordinator.stopSessionSync();
		}
		coordinators.clear();
		vi.useRealTimers();
	});
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
			requestTimeoutMs?: number;
		} = {}
	) {
		const coordinator = new PlaybackSessionCoordinator({
			origin: 'listening-room',
			fetch: fetchMock,
			debounceMs: 10,
			requestTimeoutMs: options.requestTimeoutMs,
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
		coordinators.add(coordinator);
		return coordinator;
	}

	it('automatically retries a lost intent response with the same operation identity', async () => {
		vi.useFakeTimers();
		const bodies: Array<{ operationId: string }> = [];
		let fail = true;
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			if (String(url).endsWith('/intents')) {
				bodies.push(JSON.parse(String(init?.body)));
				if (fail) throw new Error('Lost response');
				return Response.json({
					currentTrack: null,
					queue: [makeEntry(sampleTrack1, 'entry-local')],
					history: [],
					currentTime: 0,
					revision: 1
				});
			}
			return Response.json({ revision: 2 });
		});
		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});
		await vi.advanceTimersByTimeAsync(10);
		expect(coordinator.status).toBe('offline');
		expect(coordinator.queueCommands).toHaveLength(1);
		fail = false;
		await vi.advanceTimersByTimeAsync(1_000);
		expect(coordinator.status).toBe('saved');
		expect(bodies[1].operationId).toBe(bodies[0].operationId);
		expect(coordinator.queueCommands).toEqual([]);
	});

	it('times out a hung body, releases the save lock and retries', async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | null | undefined;
		const stalled = new Response(new ReadableStream());
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			signal = init?.signal;
			return stalled;
		});
		const coordinator = createCoordinator(fetchMock, { requestTimeoutMs: 20 });
		coordinator.schedulePersistence();
		await vi.advanceTimersByTimeAsync(30);
		expect(signal?.aborted).toBe(true);
		expect(coordinator.persistenceInFlight).toBe(false);
		expect(coordinator.status).toBe('offline');
		fetchMock.mockResolvedValue(Response.json({ revision: 1 }));
		await vi.advanceTimersByTimeAsync(1_000);
		expect(coordinator.status).toBe('saved');
	});

	it('does not report saved between an old acknowledgement and newer edits', async () => {
		const replies: Array<(response: Response) => void> = [];
		const fetchMock = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					replies.push(resolve);
				})
		);
		const coordinator = createCoordinator(fetchMock);
		const first = coordinator.persistPlaybackState();
		currentState.currentTime = 37;
		coordinator.schedulePersistence();
		replies[0](Response.json({ revision: 1 }));
		await first;
		expect(coordinator.status).toBe('saving');
		expect(statusHistory).not.toContain('saved');
		expect(fetchMock).toHaveBeenCalledTimes(2);
		replies[1](Response.json({ revision: 2 }));
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
	});

	it('ignores a background read that began before a queue edit', async () => {
		vi.useFakeTimers();
		let finish!: (response: Response) => void;
		const coordinator = createCoordinator(
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						finish = resolve;
					})
			)
		);
		const poll = coordinator.syncPlaybackState();
		currentState.queue = [makeEntry(sampleTrack1, 'entry-local')];
		coordinator.recordCommand({ type: 'append', entries: currentState.queue });
		finish(
			Response.json({ currentTrack: null, queue: [], history: [], currentTime: 0, revision: 99 })
		);
		await poll;
		expect(currentState.queue.map((entry) => entry.entryId)).toEqual(['entry-local']);
		expect(coordinator.revision).toBe(0);
		expect(coordinator.status).toBe('saving');
	});

	it('does not treat a successful read as acknowledgement of a failed resume write', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
			init?.method === 'PUT'
				? new Response(null, { status: 503 })
				: Response.json({ currentTrack: null, queue: [], history: [], currentTime: 0, revision: 0 })
		);
		const coordinator = createCoordinator(fetchMock);
		await coordinator.persistPlaybackState();
		await coordinator.syncPlaybackState();
		expect(coordinator.status).toBe('server_error');
		fetchMock.mockResolvedValue(Response.json({ revision: 1 }));
		await vi.advanceTimersByTimeAsync(1_000);
		expect(coordinator.status).toBe('saved');
	});

	it('uses normal fetch for a large queue exceeding the browser keepalive limit', async () => {
		currentState.queue = Array.from({ length: 100 }, (_, index) =>
			makeEntry({ ...sampleTrack1, title: 'x'.repeat(512) }, `entry-${index}`)
		);
		const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
			Response.json({ revision: 1 })
		);
		const coordinator = createCoordinator(fetchMock);
		await coordinator.persistPlaybackState();
		expect(fetchMock.mock.calls[0]?.[1]?.keepalive).toBe(false);
		expect(coordinator.status).toBe('saved');
	});

	it('retains Redis-buffered commands until the database acknowledges them', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async () => Response.json({ buffered: true }, { status: 202 }));
		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({ type: 'clear' });
		await vi.advanceTimersByTimeAsync(10);
		expect(coordinator.status).toBe('buffered');
		expect(coordinator.queueCommands).toHaveLength(1);
		fetchMock.mockImplementation(async () =>
			Response.json({ currentTrack: null, queue: [], history: [], currentTime: 0, revision: 1 })
		);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(coordinator.status).toBe('saved');
		expect(coordinator.queueCommands).toEqual([]);
	});

	it('keeps retrying a long outage with a bounded delay', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
		const coordinator = createCoordinator(fetchMock);
		await coordinator.persistPlaybackState();
		await vi.advanceTimersByTimeAsync(91_000);
		expect(fetchMock).toHaveBeenCalledTimes(8);
		expect(coordinator.status).toBe('server_error');
		fetchMock.mockImplementation(async () => Response.json({ revision: 1 }));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(coordinator.status).toBe('saved');
	});

	it('does not repeatedly write after authentication has expired', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({ type: 'clear' });
		await vi.advanceTimersByTimeAsync(120_000);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(coordinator.queueCommands).toHaveLength(1);
		expect(coordinator.status).toBe('unauthenticated');
	});

	it('saves from the first edit deadline even while more changes arrive', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async () => Response.json({ revision: 1 }));
		const coordinator = createCoordinator(fetchMock);
		coordinator.schedulePersistence();
		await vi.advanceTimersByTimeAsync(9);
		coordinator.schedulePersistence();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(coordinator.status).toBe('saved');
	});

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

	it('replays a pending queue edit after reconnect when the server revision is unchanged', async () => {
		let online = false;
		const intentBodies: Array<Record<string, unknown>> = [];
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			const path = String(url);
			if (path === '/api/playback-state/intents') {
				intentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
				if (!online) throw new Error('network down');
				return new Response(
					JSON.stringify({
						currentTrack: sampleTrack2,
						queue: [makeEntry(sampleTrack1, 'entry-local')],
						history: [],
						currentTime: 14,
						revision: 1
					}),
					{ status: 200 }
				);
			}
			if (path === '/api/playback-state' && init?.method === 'PUT') {
				return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
			}
			if (path === '/api/playback-state') {
				if (!online) throw new Error('network down');
				return new Response(
					JSON.stringify({
						currentTrack: sampleTrack2,
						queue: [],
						history: [],
						currentTime: 14,
						revision: 0
					}),
					{ status: 200 }
				);
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		currentState.currentTrack = sampleTrack3;
		currentState.currentTime = 42;
		currentState.isPlaying = true;
		currentState.hasLocalMedia = true;
		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('offline'));
		expect(coordinator.queueCommands).toHaveLength(1);
		const firstOperationId = intentBodies[0]?.operationId;

		online = true;
		await coordinator.syncPlaybackState();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));

		expect(intentBodies).toHaveLength(2);
		expect(intentBodies[1]).toMatchObject({
			expectedRevision: 0,
			operationId: firstOperationId,
			intent: { type: 'queue.append' }
		});
		expect(coordinator.queueCommands).toHaveLength(0);
		expect(appliedSession).toBeNull();
		expect(currentState.currentTrack?.id).toBe('track-3');
		expect(currentState.currentTime).toBe(42);
	});

	it('replays a pending queue edit after authentication returns', async () => {
		let authenticated = false;
		const intentBodies: Array<Record<string, unknown>> = [];
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			const path = String(url);
			if (path === '/api/playback-state/intents') {
				intentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
				if (!authenticated) {
					return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
				}
				return new Response(
					JSON.stringify({
						currentTrack: sampleTrack2,
						queue: [makeEntry(sampleTrack1, 'entry-local')],
						history: [],
						currentTime: 14,
						revision: 1
					}),
					{ status: 200 }
				);
			}
			if (path === '/api/playback-state' && init?.method === 'PUT') {
				return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
			}
			if (path === '/api/playback-state') {
				if (!authenticated) {
					return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
				}
				return new Response(
					JSON.stringify({
						currentTrack: sampleTrack2,
						queue: [],
						history: [],
						currentTime: 14,
						revision: 0
					}),
					{ status: 200 }
				);
			}
			return new Response(null, { status: 404 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});
		await vi.waitFor(() => expect(coordinator.status).toBe('unauthenticated'));
		expect(coordinator.queueCommands).toHaveLength(1);

		authenticated = true;
		await coordinator.syncPlaybackState();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));

		expect(intentBodies).toHaveLength(2);
		expect(intentBodies[1]).toMatchObject({
			expectedRevision: 0,
			operationId: intentBodies[0]?.operationId
		});
		expect(coordinator.queueCommands).toHaveLength(0);
		expect(appliedSession).toBeNull();
	});

	it('reports a service failure and preserves a queue command until retry succeeds', async () => {
		let serviceUnavailable = true;
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (String(url) === '/api/playback-state/intents') {
				if (serviceUnavailable) return new Response('temporarily unavailable', { status: 503 });
				return new Response(
					JSON.stringify({
						currentTrack: null,
						queue: [makeEntry(sampleTrack1, 'entry-local')],
						history: [],
						currentTime: 0,
						revision: 1
					}),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.recordCommand({
			type: 'append',
			entries: [makeEntry(sampleTrack1, 'entry-local')]
		});

		await vi.waitFor(() => expect(coordinator.status).toBe('server_error'));
		expect(coordinator.queueCommands).toHaveLength(1);

		serviceUnavailable = false;
		coordinator.retryAfterServerError();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
		expect(coordinator.queueCommands).toHaveLength(0);
	});

	it('reports a service failure while saving a snapshot and allows a retry', async () => {
		let serviceUnavailable = true;
		const fetchMock = vi.fn(async () => {
			if (serviceUnavailable) return new Response('internal error', { status: 500 });
			return new Response(JSON.stringify({ revision: 1 }), { status: 200 });
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.schedulePersistence();
		await vi.waitFor(() => expect(coordinator.status).toBe('server_error'));

		serviceUnavailable = false;
		coordinator.retryAfterServerError();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
	});

	it('retries a failed conflict refresh through the same recovery path', async () => {
		let serviceUnavailable = true;
		const fetchMock = vi.fn(async () => {
			if (serviceUnavailable) return new Response('internal error', { status: 500 });
			return new Response(
				JSON.stringify({
					currentTrack: null,
					queue: [makeEntry(sampleTrack2, 'entry-remote')],
					history: [],
					currentTime: 0,
					revision: 4
				}),
				{ status: 200 }
			);
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		coordinator.status = 'conflict';
		await coordinator.refreshQueueFromServer();
		expect(coordinator.status).toBe('server_error');

		serviceUnavailable = false;
		coordinator.retryAfterServerError();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
		expect(appliedQueue.map((entry) => entry.entryId)).toEqual(['entry-remote']);
	});

	it('surfaces and then clears a service error from background session sync', async () => {
		let serviceUnavailable = true;
		const fetchMock = vi.fn(async () => {
			if (serviceUnavailable) return new Response('internal error', { status: 500 });
			return new Response(
				JSON.stringify({
					currentTrack: null,
					queue: [],
					history: [],
					currentTime: 0,
					revision: 0
				}),
				{ status: 200 }
			);
		}) as typeof fetch;

		const coordinator = createCoordinator(fetchMock);
		await coordinator.syncPlaybackState();
		expect(coordinator.status).toBe('server_error');

		serviceUnavailable = false;
		coordinator.retryAfterServerError();
		await vi.waitFor(() => expect(coordinator.status).toBe('saved'));
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

describe('precise device handoff', () => {
	const track: TrackSummary = { kind: 'track', id: '42', title: 'Song', artists: [] };
	const claimed = {
		currentTrack: track,
		queue: [],
		history: [],
		currentTime: 42.125,
		revision: 2,
		activeDevice: {
			origin: 'halflight-now',
			isCurrent: true,
			expiresAt: new Date(Date.now() + 45000).toISOString()
		}
	};
	it('adopts the fresh claim position instead of the previous polled timestamp', async () => {
		const apply = vi.fn();
		const coordinator = new PlaybackSessionCoordinator({
			origin: 'halflight-now',
			getDeviceId: () => 'device_1234567890123456',
			fetch: vi.fn().mockResolvedValue(Response.json(claimed)),
			getCurrentState: () => ({
				currentTrack: track,
				queue: [],
				history: [],
				currentTime: 25.375,
				isPlaying: false,
				hasLocalMedia: false
			}),
			onApplyQueue: vi.fn(),
			onApplySession: apply
		});
		expect(await coordinator.takePlaybackControl(true)).toBe(true);
		expect(apply).toHaveBeenCalledWith(expect.objectContaining({ currentTime: 42.125 }));
	});
	it('keeps fractional media samples without using device wall clocks', () => {
		const coordinator = new PlaybackSessionCoordinator({
			origin: 'halflight-now',
			getCurrentState: () => ({
				currentTrack: track,
				queue: [],
				history: [],
				currentTime: 25.375,
				isPlaying: true,
				hasLocalMedia: true
			}),
			onApplyQueue: vi.fn()
		});
		expect(coordinator.snapshotPlaybackState()).toMatchObject({
			currentTime: 25.375,
			positionPlaying: true
		});
	});
	it('does not overwrite a newer local edit with a late claim response', async () => {
		let complete!: (value: Response) => void;
		const apply = vi.fn();
		const coordinator = new PlaybackSessionCoordinator({
			origin: 'halflight-now',
			getDeviceId: () => 'device_1234567890123456',
			fetch: vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						complete = resolve;
					})
			),
			getCurrentState: () => ({
				currentTrack: track,
				queue: [],
				history: [],
				currentTime: 25.375,
				isPlaying: false,
				hasLocalMedia: false
			}),
			onApplyQueue: vi.fn(),
			onApplySession: apply
		});
		const pending = coordinator.takePlaybackControl(true);
		coordinator.schedulePersistence();
		complete(Response.json(claimed));
		await pending;
		expect(apply).not.toHaveBeenCalled();
		coordinator.cancelPendingPersistence();
	});
});
