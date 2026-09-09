import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PlaybackSessionCoordinator,
	type SavedPlaybackState,
	type PlaybackPersistenceStatus,
	type PlaybackDeviceStatus
} from './session-coordinator.js';
import type { TrackSummary } from '#lib/tidal/models.js';
import type { QueueEntry } from './queue-entry.js';

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
		options: { canPersist?: () => boolean } = {}
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

	it('rebases on a single 409 conflict and retries successfully', async () => {
		let intentCalls = 0;
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
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

		expect(coordinator.status).toBe('saved');
		expect(coordinator.revision).toBe(22);
		expect(appliedQueue.map((e) => e.id)).toEqual(['track-2', 'track-1']);
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
});
