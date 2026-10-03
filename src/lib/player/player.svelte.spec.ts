import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerState } from './player.svelte';
import type { TrackSummary } from '#lib/tidal/models';
import type { QueueEntry } from './queue-entry';

// The player persists preferences to localStorage; isolate every case from it.
beforeEach(() => {
	try {
		localStorage.clear();
	} catch {
		/* no storage in this environment */
	}
});

// Restore the setup file's "offline" fetch after any test that overrides it.
afterEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(() => Promise.reject(new Error('fetch disabled in component tests')))
	);
	vi.useRealTimers();
});

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

function persistedQueue(...tracks: TrackSummary[]): QueueEntry[] {
	return tracks.map((track, index) => ({ ...track, entryId: `persisted-${index + 1}` }));
}

function expectQueuedTracks(player: PlayerState, tracks: TrackSummary[]): void {
	expect(player.queue.map(({ entryId: _entryId, ...track }) => track)).toEqual(tracks);
}

describe('PlayerState', () => {
	it('starts the tapped duplicate occurrence and queues only the following rows', () => {
		const player = new PlayerState();
		const context = [sampleTrack1, sampleTrack2, sampleTrack1, sampleTrack3];
		player.play(sampleTrack1, context, 'Repeated recordings', 2);
		expectQueuedTracks(player, [{ ...sampleTrack3, provenance: 'Repeated recordings' }]);
		expect(player.currentTrack?.id).toBe(sampleTrack1.id);
	});

	it('finds a repeated track by object identity when a row position is omitted', () => {
		const player = new PlayerState();
		const repeat = { ...sampleTrack1 };
		player.play(repeat, [sampleTrack1, sampleTrack2, repeat, sampleTrack3]);
		expectQueuedTracks(player, [sampleTrack3]);
	});

	it('shuffles all remaining occurrences without dropping repeated recordings', () => {
		const player = new PlayerState();
		player.shuffle = true;
		player.play(
			sampleTrack1,
			[sampleTrack1, sampleTrack2, sampleTrack1, sampleTrack3],
			undefined,
			2
		);
		expect(player.queue.map((entry) => entry.id).sort()).toEqual(
			[sampleTrack1.id, sampleTrack2.id, sampleTrack3.id].sort()
		);
		expect(new Set(player.queue.map((entry) => entry.entryId)).size).toBe(3);
	});

	it('ignores an invalid context position and resolves a copied track by ID', () => {
		const player = new PlayerState();
		player.play({ ...sampleTrack2 }, [sampleTrack1, sampleTrack2, sampleTrack3], undefined, 0);
		expectQueuedTracks(player, [sampleTrack3]);
	});

	it('plays a track and slices remaining context tracks into the queue', () => {
		const player = new PlayerState();
		player.play(sampleTrack2, [sampleTrack1, sampleTrack2, sampleTrack3]);

		expect(player.currentTrack).toEqual(sampleTrack2);
		expectQueuedTracks(player, [sampleTrack3]);
		expect(player.queue[0]?.entryId).toMatch(/^queue_/);
		expect(player.hasNext).toBe(true);
		expect(player.hasPrevious).toBe(false);
	});

	it('keeps the source provenance with the current track and queue', () => {
		const player = new PlayerState();

		player.play(sampleTrack1, [sampleTrack1, sampleTrack2], 'Playlist · Night Drive');

		expect(player.currentTrack?.provenance).toBe('Playlist · Night Drive');
		expect(player.queue[0]?.provenance).toBe('Playlist · Night Drive');
	});

	it('preserves a track-specific provenance over a generic source label', () => {
		const player = new PlayerState();
		const generated = { ...sampleTrack1, provenance: 'Appears on three of your playlists' };

		player.play(generated, [generated], 'Playlist · Night Drive');

		expect(player.currentTrack?.provenance).toBe('Appears on three of your playlists');
	});

	it('adds tracks to queue and removes one occurrence by stable entry ID', () => {
		const player = new PlayerState();
		player.addToQueue(sampleTrack1);
		player.addToQueue(sampleTrack2);
		expect(player.queueCount).toBe(2);

		player.removeFromQueue(player.queue[0]!.entryId);
		expectQueuedTracks(player, [sampleTrack2]);

		player.clearQueue();
		expect(player.queue).toEqual([]);
	});

	it('inserts a track next while retaining its source provenance', () => {
		const player = new PlayerState();
		player.addToQueue(sampleTrack2, 'Search');
		player.playNext(sampleTrack1, 'Album · Discovery');

		expectQueuedTracks(player, [
			{ ...sampleTrack1, provenance: 'Album · Discovery' },
			{ ...sampleTrack2, provenance: 'Search' }
		]);
	});

	it('advances to next track in queue and retains history', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.addToQueue(sampleTrack3);

		const next = player.next();
		expect(next).toEqual(sampleTrack2);
		expect(player.currentTrack).toEqual(sampleTrack2);
		expect(player.history).toEqual([sampleTrack1]);
		expectQueuedTracks(player, [sampleTrack3]);
		expect(player.hasPrevious).toBe(true);

		const prev = player.previous();
		expect(prev).toEqual(sampleTrack1);
		expect(player.currentTrack).toEqual(sampleTrack1);
		expectQueuedTracks(player, [sampleTrack2, sampleTrack3]);
	});

	it('plays directly from queue', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.addToQueue(sampleTrack3);

		player.playFromQueue(player.queue[1]!.entryId);
		expect(player.currentTrack).toEqual(sampleTrack3);
		expectQueuedTracks(player, [sampleTrack2]);
		expect(player.history).toEqual([sampleTrack1]);
	});

	it('handles closing the player', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.close();

		expect(player.currentTrack).toBeNull();
		expect(player.queue).toEqual([]);
		expect(player.history).toEqual([]);
	});

	it('hydrates persisted volume and ReplayGain preferences', () => {
		const player = new PlayerState();

		player.applyStreamingSettings({ volume: 42, loudnessNormalization: false });

		expect(player.volume).toBe(0.42);
		expect(player.isMuted).toBe(false);
		expect(player.isNormalizationEnabled).toBe(false);
	});

	it('supports VLC-style +25% overloudness headroom (up to 125%) by default', () => {
		const player = new PlayerState();
		expect(player.isHeadroomEnabled).toBe(true);
		expect(player.maxVolume).toBe(1.25);

		player.setVolume(0.75);
		expect(player.volume).toBe(0.75);
		expect(player.volumePercent).toBe(75);
		expect(player.isMuted).toBe(false);

		// Allows setting up to 1.25 (125%)
		player.setVolume(1.15);
		expect(player.volume).toBe(1.15);
		expect(player.volumePercent).toBe(115);

		// Clamps to max 1.25 (125%)
		player.setVolume(1.5);
		expect(player.volume).toBe(1.25);
		expect(player.volumePercent).toBe(125);

		// Setting <= 0 mutes
		player.setVolume(0);
		expect(player.volume).toBe(0);
		expect(player.isMuted).toBe(true);

		// Negative clamps to 0
		player.setVolume(-0.5);
		expect(player.volume).toBe(0);
	});

	it('clamps volume to standard 100% when headroom is toggled off', () => {
		const player = new PlayerState();
		player.setVolume(1.25);
		expect(player.volume).toBe(1.25);

		player.toggleHeadroom();
		expect(player.isHeadroomEnabled).toBe(false);
		expect(player.maxVolume).toBe(1);
		expect(player.volume).toBe(1);
		expect(player.volumePercent).toBe(100);

		// Setting > 1 when headroom disabled clamps to 1
		player.setVolume(1.2);
		expect(player.volume).toBe(1);
		expect(player.volumePercent).toBe(100);
	});

	it('persists and restores volume and headroom preferences from localStorage', () => {
		localStorage.setItem(
			'syn:player:prefs',
			JSON.stringify({
				volume: 1.2,
				isHeadroomEnabled: true
			})
		);

		const player = new PlayerState();
		expect(player.isHeadroomEnabled).toBe(true);
		expect(player.volume).toBe(1.2);
		expect(player.volumePercent).toBe(120);

		// Shell hydration also carries the server default. It must not undo the
		// volume the owner already chose in the player.
		player.applyStreamingSettings({ volume: 100, loudnessNormalization: false });
		expect(player.volume).toBe(1.2);
		expect(player.isNormalizationEnabled).toBe(false);
	});

	it('toggles mute state independently', () => {
		const player = new PlayerState();
		player.setVolume(0.8);
		expect(player.isMuted).toBe(false);

		player.toggleMute();
		expect(player.isMuted).toBe(true);
		expect(player.volume).toBe(0.8);

		player.toggleMute();
		expect(player.isMuted).toBe(false);
		expect(player.volume).toBe(0.8);
	});

	it('seeks by relative offset and clamps within track bounds', () => {
		const player = new PlayerState();
		player.duration = 200;
		player.currentTime = 50;

		player.seekBy(15);
		expect(player.currentTime).toBe(65);

		player.seekBy(-100);
		expect(player.currentTime).toBe(0);

		player.seekBy(500);
		expect(player.currentTime).toBe(200);
	});

	it('previews a scrub without moving playback, and commits it once on release', () => {
		const player = new PlayerState();
		player.duration = 200;
		player.currentTime = 50;

		// A drag emits one event per step. None of them may touch playback: every
		// `currentTime` write can provoke a fresh Range request upstream.
		player.scrubTo(60);
		player.scrubTo(120);
		player.scrubTo(180);
		expect(player.currentTime).toBe(50);
		expect(player.displayTime).toBe(180);

		player.commitScrub();
		expect(player.currentTime).toBe(180);
		expect(player.scrubPosition).toBeNull();
		expect(player.displayTime).toBe(180);
	});

	it('clamps a scrub to the track and discards an abandoned drag', () => {
		const player = new PlayerState();
		player.duration = 200;
		player.currentTime = 50;

		player.scrubTo(500);
		expect(player.displayTime).toBe(200);
		player.scrubTo(-20);
		expect(player.displayTime).toBe(0);

		player.cancelScrub();
		expect(player.scrubPosition).toBeNull();
		expect(player.displayTime).toBe(50);

		// Committing with no drag in flight must not move playback.
		player.commitScrub();
		expect(player.currentTime).toBe(50);
	});

	it('drops a scrub preview when the track changes mid-drag', () => {
		const player = new PlayerState();
		player.duration = 200;
		player.currentTime = 50;
		player.scrubTo(180);

		player.play(sampleTrack2);

		expect(player.scrubPosition).toBeNull();
		expect(player.currentTime).toBe(0);
	});

	it('adjusts volume by relative delta with bounds clamping', () => {
		const player = new PlayerState();
		player.setVolume(0.5);

		player.adjustVolume(0.1);
		expect(player.volume).toBe(0.6);

		player.adjustVolume(-0.8);
		expect(player.volume).toBe(0);
		expect(player.isMuted).toBe(true);
	});

	it('restores a saved queue and position without starting playback', () => {
		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: persistedQueue(sampleTrack2),
			history: [sampleTrack3],
			currentTime: 67.8
		});

		expect(player.currentTrack).toEqual(sampleTrack1);
		expectQueuedTracks(player, [sampleTrack2]);
		expect(player.history).toEqual([sampleTrack3]);
		expect(player.currentTime).toBe(67);
		expect(player.isPlaying).toBe(false);
	});

	// Must match the private `QUEUE_CACHE_KEY` in player.svelte.ts.
	const QUEUE_CACHE_KEY = 'syn:player:queue-cache';

	it('optimistically paints a queue cached from a prior session before any server restore', () => {
		localStorage.setItem(
			QUEUE_CACHE_KEY,
			JSON.stringify({
				version: 1,
				currentTrack: sampleTrack1,
				queue: persistedQueue(sampleTrack2),
				history: [sampleTrack3],
				currentTime: 42
			})
		);

		const player = new PlayerState();

		expect(player.currentTrack).toEqual(sampleTrack1);
		expectQueuedTracks(player, [sampleTrack2]);
		expect(player.history).toEqual([sampleTrack3]);
		expect(player.currentTime).toBe(42);
	});

	it('lets the authoritative server restore overwrite an optimistic local-cache seed', () => {
		localStorage.setItem(
			QUEUE_CACHE_KEY,
			JSON.stringify({
				version: 1,
				currentTrack: sampleTrack1,
				queue: [],
				history: [],
				currentTime: 10
			})
		);

		const player = new PlayerState();
		expect(player.currentTrack).toEqual(sampleTrack1);

		player.restorePlaybackState({
			currentTrack: sampleTrack3,
			queue: persistedQueue(sampleTrack2),
			history: [],
			currentTime: 99
		});

		expect(player.currentTrack).toEqual(sampleTrack3);
		expectQueuedTracks(player, [sampleTrack2]);
		expect(player.currentTime).toBe(99);
	});

	it('rebases a locally journaled queue edit onto the server state after a restart', () => {
		const localEntry = { ...sampleTrack2, entryId: 'local-entry' };
		const remoteEntry = { ...sampleTrack3, entryId: 'remote-entry' };
		localStorage.setItem(
			QUEUE_CACHE_KEY,
			JSON.stringify({
				version: 2,
				currentTrack: sampleTrack1,
				queue: [localEntry],
				history: [],
				currentTime: 12,
				queueCommands: [
					{
						type: 'append',
						entries: [localEntry],
						operationId: 'operation_restart_append'
					}
				]
			})
		);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: [remoteEntry],
			history: [],
			currentTime: 7,
			revision: 4
		});

		expect(player.queue.map((entry) => entry.id)).toEqual(['track-3', 'track-2']);
		expect(player.queueCommands).toEqual([
			expect.objectContaining({ operationId: 'operation_restart_append' })
		]);
	});

	it('retains every valid unsent queue command from the local journal', () => {
		const commands = Array.from({ length: 101 }, () => ({ type: 'clear' as const }));
		localStorage.setItem(
			QUEUE_CACHE_KEY,
			JSON.stringify({
				version: 2,
				currentTrack: null,
				queue: [],
				history: [],
				queueCommands: commands
			})
		);

		const player = new PlayerState();

		expect(player.queueCommands).toHaveLength(101);
	});

	it('ignores a queue cache with an unrecognised version', () => {
		localStorage.setItem(
			QUEUE_CACHE_KEY,
			JSON.stringify({ version: 999, currentTrack: sampleTrack1, queue: [], history: [] })
		);

		const player = new PlayerState();

		expect(player.currentTrack).toBeNull();
	});

	it('mirrors the current queue to localStorage so the next load can paint instantly', () => {
		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: persistedQueue(sampleTrack2),
			history: [sampleTrack3],
			currentTime: 12
		});

		player.schedulePersistence();

		const cached = JSON.parse(localStorage.getItem(QUEUE_CACHE_KEY) ?? 'null');
		expect(cached.version).toBe(2);
		expect(cached.currentTrack).toEqual(sampleTrack1);
		expect(cached.history).toEqual([sampleTrack3]);
	});

	it('keeps a durable clear command in the local queue cache until it is acknowledged', () => {
		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: [],
			history: [],
			currentTime: 0
		});
		player.schedulePersistence();
		expect(localStorage.getItem(QUEUE_CACHE_KEY)).not.toBeNull();

		player.close();

		const cached = JSON.parse(localStorage.getItem(QUEUE_CACHE_KEY) ?? 'null');
		expect(cached.queueCommands).toEqual([{ type: 'replace', entries: [] }]);
	});

	it('keeps a restored remote session passive until this device explicitly takes playback', async () => {
		const fetchSpy = vi.fn((url: string) => {
			if (url !== '/api/playback-state/claim') return Promise.reject(new Error('not needed'));
			return Promise.resolve(
				new Response(
					JSON.stringify({
						currentTrack: sampleTrack1,
						queue: [],
						history: [],
						currentTime: 7,
						revision: 2,
						activeDevice: {
							origin: 'halflight-now',
							expiresAt: new Date(Date.now() + 45_000).toISOString(),
							isCurrent: true
						}
					}),
					{ status: 200 }
				)
			);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: [],
			history: [],
			currentTime: 7,
			revision: 1,
			activeDevice: {
				origin: 'listening-room',
				expiresAt: new Date(Date.now() + 45_000).toISOString(),
				isCurrent: false
			}
		});

		expect(fetchSpy.mock.calls.some(([url]) => url === '/api/playback-state/claim')).toBe(false);
		await expect(player.takePlaybackControl()).resolves.toBe(true);
		expect(fetchSpy).toHaveBeenCalledWith(
			'/api/playback-state/claim',
			expect.objectContaining({ method: 'POST' })
		);
		expect(player.isPlaybackActiveHere).toBe(true);
	});

	it('reconciles a newer remote session without starting playback', async () => {
		const fetchSpy = vi.fn(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						currentTrack: sampleTrack2,
						queue: persistedQueue(sampleTrack3),
						history: [sampleTrack1],
						currentTime: 42,
						revision: 2
					}),
					{ status: 200 }
				)
			)
		);
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: persistedQueue(sampleTrack2),
			history: [],
			currentTime: 7,
			revision: 1
		});
		await player.syncPlaybackState();

		expect(player.currentTrack).toEqual(sampleTrack2);
		expectQueuedTracks(player, [sampleTrack3]);
		expect(player.history).toEqual([sampleTrack1]);
		expect(player.currentTime).toBe(42);
		expect(player.isPlaying).toBe(false);
	});

	it('never replaces the audible track or seek position during a remote session refresh', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack2,
							queue: persistedQueue(sampleTrack3),
							history: [sampleTrack2],
							currentTime: 42,
							revision: 2
						}),
						{ status: 200 }
					)
				)
			)
		);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: [],
			history: [],
			currentTime: 7,
			revision: 1
		});
		player.isPlaying = true;
		await player.syncPlaybackState();

		expect(player.currentTrack).toEqual(sampleTrack1);
		expect(player.currentTime).toBe(7);
		expectQueuedTracks(player, [sampleTrack3]);
	});

	it('never replaces a paused track whose local media source is still loaded', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack2,
							queue: persistedQueue(sampleTrack3),
							history: [],
							currentTime: 42,
							revision: 2
						}),
						{ status: 200 }
					)
				)
			)
		);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: [],
			history: [],
			currentTime: 7,
			revision: 1
		});
		player.streamUrl = '/tidal/audio/track-1';
		await player.syncPlaybackState();

		expect(player.currentTrack).toEqual(sampleTrack1);
		expect(player.currentTime).toBe(7);
		expectQueuedTracks(player, [sampleTrack3]);
	});

	it('does not show an unsaved-queue warning when a background session read fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.reject(new Error('offline')))
		);
		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });

		await player.syncPlaybackState();

		expect(player.persistenceStatus).toBe('saved');
	});

	it('reorders queued tracks with moveQueueItem', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addMultipleToQueue([sampleTrack2, sampleTrack3]);

		const second = player.queue[1]!.entryId;
		player.moveQueueItem(second, -1);
		expectQueuedTracks(player, [sampleTrack3, sampleTrack2]);
		player.moveQueueItem(second, -1); // no-op at the top edge
		expectQueuedTracks(player, [sampleTrack3, sampleTrack2]);
	});
	it('appends a whole playlist with one durable command and one local-cache write', () => {
		const player = new PlayerState();
		const tracks = Array.from({ length: 100 }, (_, index) => ({
			...sampleTrack1,
			id: `playlist-${index}`,
			...(index === 0 ? { provenance: 'Track-specific source' } : {})
		}));
		const write = vi.spyOn(Storage.prototype, 'setItem');
		try {
			player.addMultipleToQueue(tracks, 'Saved playlist');
			expect(player.queue).toHaveLength(100);
			expect(new Set(player.queue.map((entry) => entry.entryId)).size).toBe(100);
			expect(player.queue[0].provenance).toBe('Track-specific source');
			expect(player.queue[99].provenance).toBe('Saved playlist');
			expect(player.queueCommands).toEqual([{ type: 'append', entries: player.queue }]);
			expect(write.mock.calls.filter(([key]) => key === 'syn:player:queue-cache')).toHaveLength(1);
			const cached = JSON.parse(localStorage.getItem('syn:player:queue-cache') ?? 'null');
			expect(cached.queue).toHaveLength(100);
			expect(cached.queueCommands).toHaveLength(1);
		} finally {
			write.mockRestore();
		}
	});

	it('reorders queued tracks with reorderQueue and queues replacement command', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addMultipleToQueue([sampleTrack2, sampleTrack3]);

		const [first, second] = player.queue;
		player.reorderQueue([second!, first!]);
		expectQueuedTracks(player, [sampleTrack3, sampleTrack2]);
		expect(player.queueCommands).toContainEqual({
			type: 'replace',
			entries: [second, first]
		});
	});

	it('repeat-one replays the current track on an automatic advance', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.cycleRepeat(); // off -> all
		player.cycleRepeat(); // all -> one
		expect(player.repeatMode).toBe('one');

		player.next(true);
		expect(player.currentTrack).toEqual(sampleTrack1);
		expectQueuedTracks(player, [sampleTrack2]);
	});

	it('repeat-all refills the queue from history once it empties', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.cycleRepeat(); // -> all

		player.next(); // -> track2, history [track1], queue []
		const looped = player.next(); // queue empty + repeat all -> refill
		expect(looped).toEqual(sampleTrack1);
		expectQueuedTracks(player, [sampleTrack2]);
	});

	it('shuffle queues every other context track and toggleShuffle is idempotent state', () => {
		const player = new PlayerState();
		player.toggleShuffle();
		expect(player.shuffle).toBe(true);
		player.play(sampleTrack2, [sampleTrack1, sampleTrack2, sampleTrack3]);
		expect(player.queue).toHaveLength(2);
		expect(player.queue.map((t) => t.id).sort()).toEqual(['track-1', 'track-3']);
	});

	it('toggleDock flips between docked and floating', () => {
		const player = new PlayerState();
		expect(player.dockMode).toBe('docked');
		player.toggleDock();
		expect(player.dockMode).toBe('floating');
		expect(player.isExpanded).toBe(true);
		player.toggleDock();
		expect(player.dockMode).toBe('docked');
	});

	it('openPanel expands to a panel and collapses when reselected', () => {
		const player = new PlayerState();
		player.openPanel('queue');
		expect(player.isExpanded).toBe(true);
		expect(player.panel).toBe('queue');
		player.openPanel('queue');
		expect(player.isExpanded).toBe(false);
	});

	it('selectPanel changes tabs without collapsing the player', () => {
		const player = new PlayerState();
		player.selectPanel('source');
		expect(player.isExpanded).toBe(true);
		expect(player.panel).toBe('source');
		player.selectPanel('source');
		expect(player.isExpanded).toBe(true);
	});

	it('advancing to the next track clears every trace of the previous one', () => {
		const player = new PlayerState();
		player.play(sampleTrack1, [sampleTrack1, sampleTrack2]);

		// Simulate a partly-played track with resolved stream + lyrics state.
		player.currentTime = 47;
		player.audioQuality = 'LOSSLESS';
		player.codecs = 'flac';
		player.lyrics = 'previous words';
		player.lyricsCues = [{ time: 1, text: 'previous' }];
		player.playbackMode = 'embed';

		player.next();

		expect(player.currentTrack?.id).toBe('track-2');
		expect(player.currentTime).toBe(0);
		expect(player.streamUrl).toBeNull();
		expect(player.audioQuality).toBeNull();
		expect(player.codecs).toBeNull();
		expect(player.lyrics).toBeNull();
		expect(player.lyricsCues).toEqual([]);
		expect(player.playbackMode).toBe('direct');
		// The load guard is armed synchronously so a late `timeupdate` from the
		// outgoing <audio> can't rewrite the position mid-fetch.
		expect(player.isLoading).toBe(true);
	});

	it('ignores audio position updates while a track is loading', () => {
		const player = new PlayerState();
		const tick = player as unknown as { onTimeUpdate: () => void };

		player.isLoading = true;
		player.currentTime = 10;
		tick.onTimeUpdate();
		expect(player.currentTime).toBe(10);
	});

	it('supplies missing artwork immediately without a preliminary cover lookup', () => {
		const fetchSpy = vi.fn((_url: string) => Promise.reject(new Error('offline')));
		vi.stubGlobal('fetch', fetchSpy);
		const player = new PlayerState();
		player.play({ ...sampleTrack1, id: '123', imageUrl: undefined });
		expect(player.currentTrack?.imageUrl).toBe('/api/tracks/123/artwork');
		expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/cover'))).toBe(false);
	});

	it('does not fetch metadata for known tracks solely because their release date is absent', async () => {
		vi.useFakeTimers();
		const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
		vi.stubGlobal('fetch', fetchSpy);
		const player = new PlayerState();
		const track = {
			...sampleTrack1,
			id: 'known-without-release-date',
			album: { id: 'album-1', title: 'Known album' }
		};
		player.restorePlaybackState({
			currentTrack: track,
			queue: persistedQueue(track),
			history: [track],
			currentTime: 0
		});
		player.retryUnresolvedMetadata();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(fetchSpy).not.toHaveBeenCalledWith('/api/tracks/known-without-release-date/metadata');
		expect(player.currentTrack?.title).toBe(track.title);
	});

	it('hydrates an identifier-only resumed track with live display metadata', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				if (String(url).endsWith('/metadata')) {
					return Promise.resolve(
						new Response(
							JSON.stringify({
								track: {
									kind: 'track',
									id: 'track-1',
									title: 'Bela Lugosi Is Dead',
									artists: [{ id: 'artist-1', name: 'Bauhaus' }],
									album: {
										id: 'album-1',
										title: 'Press the Eject',
										releaseDate: '1982-01-01'
									}
								}
							}),
							{ status: 200 }
						)
					);
				}
				return Promise.reject(new Error('offline'));
			})
		);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: {
				kind: 'track',
				id: 'track-1',
				title: 'track-1',
				artists: [{ id: 'artist-1', name: 'artist-1' }]
			},
			queue: [],
			history: [],
			currentTime: 0
		});

		await vi.waitFor(() => expect(player.currentTrack?.title).toBe('Bela Lugosi Is Dead'));
		expect(player.currentTrack?.artists).toEqual([{ id: 'artist-1', name: 'Bauhaus' }]);
		expect(player.currentTrack?.album).toEqual({
			id: 'album-1',
			title: 'Press the Eject',
			releaseDate: '1982-01-01'
		});
	});

	it('hydrates identifier-only queue and history entries after restoring a session', async () => {
		const metadataById: Record<string, TrackSummary> = {
			'track-2': {
				kind: 'track',
				id: 'track-2',
				title: 'A Forest',
				artists: [{ id: 'artist-2', name: 'The Cure' }],
				album: { id: 'album-2', title: 'Seventeen Seconds', releaseDate: '1980-04-18' }
			},
			'track-3': {
				kind: 'track',
				id: 'track-3',
				title: 'Transmission',
				artists: [{ id: 'artist-3', name: 'Joy Division' }],
				album: { id: 'album-3', title: 'Unknown Pleasures', releaseDate: '1979-06-15' }
			}
		};
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				const trackId = String(url).match(/\/api\/tracks\/([^/]+)\/metadata$/)?.[1];
				const track = trackId ? metadataById[trackId] : undefined;
				return track
					? Promise.resolve(new Response(JSON.stringify({ track }), { status: 200 }))
					: Promise.reject(new Error('offline'));
			})
		);

		const unresolved = (id: string, artistId: string): TrackSummary => ({
			kind: 'track',
			id,
			title: id,
			artists: [{ id: artistId, name: artistId }]
		});
		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: null,
			queue: persistedQueue(unresolved('track-2', 'artist-2')),
			history: [unresolved('track-3', 'artist-3')],
			currentTime: 0
		});

		await vi.waitFor(() => expect(player.queue[0]?.title).toBe('A Forest'));
		expect(player.queue[0]?.artists).toEqual([{ id: 'artist-2', name: 'The Cure' }]);
		expect(player.history[0]?.title).toBe('Transmission');
		expect(player.history[0]?.artists).toEqual([{ id: 'artist-3', name: 'Joy Division' }]);
	});

	it('bounds restore-time metadata hydration for a legacy queue', async () => {
		vi.useFakeTimers();
		const fetchSpy = vi.fn((url: string) => {
			if (!String(url).endsWith('/metadata')) return Promise.reject(new Error('offline'));
			return Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const unresolved = (id: string): TrackSummary => ({
			kind: 'track',
			id,
			title: id,
			artists: [{ id: `artist-${id}`, name: `artist-${id}` }]
		});
		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: null,
			queue: Array.from(
				{ length: 20 },
				(_, index) => persistedQueue(unresolved(`track-${index}`))[0]!
			),
			history: Array.from({ length: 10 }, (_, index) => unresolved(`history-${index}`)),
			currentTime: 0
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(metadataCallCount(fetchSpy)).toBe(8);
	});

	it('retries a transient hydration failure (a dropped connection, an upstream blip) and recovers', async () => {
		vi.useFakeTimers();
		let attempts = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				if (!String(url).endsWith('/metadata')) return Promise.reject(new Error('offline'));
				attempts++;
				// The first two attempts land mid-outage; the third succeeds.
				if (attempts < 3) return Promise.resolve(new Response(null, { status: 502 }));
				return Promise.resolve(
					new Response(
						JSON.stringify({
							track: {
								kind: 'track',
								id: 'track-1',
								title: 'Bela Lugosi Is Dead',
								artists: [{ id: 'artist-1', name: 'Bauhaus' }]
							}
						}),
						{ status: 200 }
					)
				);
			})
		);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: {
				kind: 'track',
				id: 'track-1',
				title: 'track-1',
				artists: [{ id: 'artist-1', name: 'artist-1' }]
			},
			queue: [],
			history: [],
			currentTime: 0
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(attempts).toBe(1);
		expect(player.currentTrack?.title).toBe('track-1'); // still unresolved

		await vi.advanceTimersByTimeAsync(1500); // first backoff
		expect(attempts).toBe(2);
		await vi.advanceTimersByTimeAsync(3000); // second backoff
		expect(attempts).toBe(3);
		// The final timer starts the request; flush its response/body microtasks
		// before checking the enriched reactive player state.
		await vi.advanceTimersByTimeAsync(0);

		expect(player.currentTrack?.title).toBe('Bela Lugosi Is Dead');
	});

	/** Count metadata hydration independently of other background playback requests. */
	function metadataCallCount(fetchSpy: ReturnType<typeof vi.fn>): number {
		return fetchSpy.mock.calls.filter(([url]) => String(url).endsWith('/metadata')).length;
	}

	it('gives up after a bounded number of transient retries, without hammering the endpoint forever', async () => {
		vi.useFakeTimers();
		const fetchSpy = vi.fn((url: string) => {
			if (!String(url).endsWith('/metadata')) return Promise.reject(new Error('offline'));
			return Promise.resolve(new Response(null, { status: 502 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: {
				kind: 'track',
				id: 'track-1',
				title: 'track-1',
				artists: [{ id: 'artist-1', name: 'artist-1' }]
			},
			queue: [],
			history: [],
			currentTime: 0
		});

		await vi.advanceTimersByTimeAsync(0); // attempt 1
		await vi.advanceTimersByTimeAsync(1500); // attempt 2
		await vi.advanceTimersByTimeAsync(3000); // attempt 3 — the last one
		expect(metadataCallCount(fetchSpy)).toBe(3);

		// No further retry is ever scheduled past the bound.
		await vi.advanceTimersByTimeAsync(60_000);
		expect(metadataCallCount(fetchSpy)).toBe(3);
		expect(player.currentTrack?.title).toBe('track-1'); // stays honestly unresolved
	});

	it('never retries a confirmed 404 — that request can never be answered', async () => {
		vi.useFakeTimers();
		const fetchSpy = vi.fn((url: string) => {
			if (!String(url).endsWith('/metadata')) return Promise.reject(new Error('offline'));
			return Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: {
				kind: 'track',
				id: 'track-1',
				title: 'track-1',
				artists: [{ id: 'artist-1', name: 'artist-1' }]
			},
			queue: [],
			history: [],
			currentTime: 0
		});

		await vi.advanceTimersByTimeAsync(60_000);
		expect(metadataCallCount(fetchSpy)).toBe(1);
		expect(player.currentTrack?.title).toBe('track-1');
	});

	it('retryUnresolvedMetadata() gives a transient failure another chance immediately', async () => {
		vi.useFakeTimers();
		let attempts = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				if (!String(url).endsWith('/metadata')) return Promise.reject(new Error('offline'));
				attempts++;
				if (attempts === 1) return Promise.resolve(new Response(null, { status: 502 }));
				return Promise.resolve(
					new Response(
						JSON.stringify({
							track: {
								kind: 'track',
								id: 'track-1',
								title: 'Bela Lugosi Is Dead',
								artists: [{ id: 'artist-1', name: 'Bauhaus' }]
							}
						}),
						{ status: 200 }
					)
				);
			})
		);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: {
				kind: 'track',
				id: 'track-1',
				title: 'track-1',
				artists: [{ id: 'artist-1', name: 'artist-1' }]
			},
			queue: [],
			history: [],
			currentTime: 0
		});

		// Flushes the first attempt's whole lifecycle, including the `finally`
		// that clears the in-flight guard — not just the moment `fetch` is called.
		await vi.advanceTimersByTimeAsync(0);
		expect(attempts).toBe(1);
		expect(player.currentTrack?.title).toBe('track-1'); // still unresolved, backoff not due yet

		// This is what QueuePanel calls on mount — no need to wait out the backoff.
		player.retryUnresolvedMetadata();
		await vi.advanceTimersByTimeAsync(0);

		expect(player.currentTrack?.title).toBe('Bela Lugosi Is Dead');
		expect(attempts).toBe(2);
	});

	it('retryUnresolvedMetadata() leaves a confirmed 404 alone', async () => {
		vi.useFakeTimers();
		const fetchSpy = vi.fn((url: string) => {
			if (!String(url).endsWith('/metadata')) return Promise.reject(new Error('offline'));
			return Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({
			currentTrack: {
				kind: 'track',
				id: 'track-1',
				title: 'track-1',
				artists: [{ id: 'artist-1', name: 'artist-1' }]
			},
			queue: [],
			history: [],
			currentTime: 0
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(metadataCallCount(fetchSpy)).toBe(1);

		player.retryUnresolvedMetadata();
		await vi.advanceTimersByTimeAsync(0);

		expect(metadataCallCount(fetchSpy)).toBe(1); // no wasted request for a track that will never exist
	});

	it('does not fetch a cover when the track already has artwork', async () => {
		const fetchSpy = vi.fn((_url: string) => Promise.reject(new Error('offline')));
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.play({ ...sampleTrack1, imageUrl: 'https://img.test/existing.jpg' });
		await Promise.resolve();

		expect(fetchSpy.mock.calls.some((args) => String(args[0]).endsWith('/cover'))).toBe(false);
	});

	it('attributes a persisted write to the site the player is acting as', async () => {
		const fetchSpy = vi.fn((url: string, _init?: RequestInit) => {
			if (String(url) === '/api/playback-state/intents') {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: null,
							queue: persistedQueue(sampleTrack1),
							history: [],
							currentTime: 0,
							revision: 1
						}),
						{ status: 200 }
					)
				);
			}
			if (String(url) === '/api/playback-state') {
				return Promise.resolve(new Response(JSON.stringify({ revision: 2 }), { status: 200 }));
			}
			return Promise.reject(new Error('offline'));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.origin = 'halflight-now';
		player.addToQueue(sampleTrack1);

		await vi.waitFor(
			() => expect(fetchSpy).toHaveBeenCalledWith('/api/playback-state/intents', expect.anything()),
			{ timeout: 2000 }
		);
		const call = fetchSpy.mock.calls.find(([url]) => String(url) === '/api/playback-state/intents');
		const body = JSON.parse(String(call?.[1]?.body));
		expect(body.origin).toBe('halflight-now');
		expect(body).toMatchObject({ version: 2, intent: { type: 'queue.append' } });
		expect(body.operationId).toMatch(/^operation_/);
	});

	it('serializes a changed queue behind an in-flight persistence write', async () => {
		let resolveFirst: ((response: Response) => void) | undefined;
		const firstResponse = new Promise<Response>((resolve) => {
			resolveFirst = resolve;
		});
		let intentCalls = 0;
		const fetchSpy = vi.fn((url: string, _init?: RequestInit) => {
			if (url === '/api/playback-state') {
				return Promise.resolve(new Response(JSON.stringify({ revision: 3 }), { status: 200 }));
			}
			if (url !== '/api/playback-state/intents') return Promise.reject(new Error('offline'));
			intentCalls += 1;
			return intentCalls === 1
				? firstResponse
				: Promise.resolve(
						new Response(
							JSON.stringify({
								currentTrack: null,
								queue: persistedQueue(sampleTrack1, sampleTrack2),
								history: [],
								currentTime: 0,
								revision: 2
							}),
							{ status: 200 }
						)
					);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.addToQueue(sampleTrack1);
		await vi.waitFor(() => expect(intentCalls).toBe(1));

		player.addToQueue(sampleTrack2);
		resolveFirst?.(
			new Response(
				JSON.stringify({
					currentTrack: null,
					queue: persistedQueue(sampleTrack1),
					history: [],
					currentTime: 0,
					revision: 1
				}),
				{ status: 200 }
			)
		);

		await vi.waitFor(() => expect(intentCalls).toBe(2));
		const persistenceWrites = fetchSpy.mock.calls.filter(
			([url]) => url === '/api/playback-state/intents'
		);
		const secondBody = JSON.parse(String(persistenceWrites[1]?.[1]?.body));
		expect(secondBody).toMatchObject({
			expectedRevision: 1,
			intent: { type: 'queue.append', entries: [expect.objectContaining({ id: 'track-2' })] }
		});
	});

	it('rebases a stale local queue edit and retries without interrupting playback', async () => {
		let intentCalls = 0;
		const fetchSpy = vi.fn((url: string, _init?: RequestInit) => {
			if (url === '/api/playback-state') {
				return Promise.resolve(new Response(JSON.stringify({ revision: 5 }), { status: 200 }));
			}
			if (url !== '/api/playback-state/intents') return Promise.reject(new Error('offline'));
			intentCalls += 1;
			return intentCalls === 1
				? Promise.resolve(
						new Response(
							JSON.stringify({
								currentTrack: sampleTrack2,
								queue: persistedQueue(sampleTrack2),
								history: [],
								currentTime: 19,
								revision: 4
							}),
							{ status: 409 }
						)
					)
				: Promise.resolve(
						new Response(
							JSON.stringify({
								currentTrack: sampleTrack2,
								queue: [
									...persistedQueue(sampleTrack2),
									{ ...sampleTrack1, entryId: 'queue-local' }
								],
								history: [],
								currentTime: 19,
								revision: 5
							}),
							{ status: 200 }
						)
					);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.addToQueue(sampleTrack1);

		await vi.waitFor(() => expect(player.persistenceStatus).toBe('saved'));
		expect(intentCalls).toBe(2);
		expect(player.currentTrack).toBeNull();
		expectQueuedTracks(player, [sampleTrack2, sampleTrack1]);
		const writes = (fetchSpy.mock.calls as Array<[string, RequestInit?]>).filter(
			([url]) => url === '/api/playback-state/intents'
		);
		const retry = JSON.parse(String(writes[1]?.[1]?.body));
		expect(retry).toMatchObject({
			expectedRevision: 4,
			intent: { type: 'queue.append', entries: [expect.objectContaining({ id: 'track-1' })] }
		});
	});

	it('recovers an offline mobile queue edit on reconnect without claiming or replacing playback', async () => {
		let online = false;
		const intentBodies: Array<Record<string, unknown>> = [];
		let claimCalls = 0;
		const fetchSpy = vi.fn((url: string, init?: RequestInit) => {
			if (url === '/api/playback-state/claim') {
				claimCalls += 1;
				return Promise.resolve(new Response(null, { status: 409 }));
			}
			if (url === '/api/playback-state/intents') {
				intentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
				if (!online) return Promise.reject(new Error('network down'));
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack3,
							queue: persistedQueue(sampleTrack2),
							history: [],
							currentTime: 30,
							revision: 1,
							activeDevice
						}),
						{ status: 200 }
					)
				);
			}
			if (url === '/api/playback-state' && init?.method === 'PUT') {
				return Promise.resolve(new Response(JSON.stringify({ revision: 2 }), { status: 200 }));
			}
			if (url === '/api/playback-state') {
				if (!online) return Promise.reject(new Error('network down'));
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack3,
							queue: [],
							history: [],
							currentTime: 30,
							revision: 0,
							activeDevice
						}),
						{ status: 200 }
					)
				);
			}
			return Promise.resolve(new Response(null, { status: 404 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const activeDevice = {
			origin: 'halflight-now' as const,
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			isCurrent: true
		};
		const player = new PlayerState();
		player.origin = 'halflight-now';
		player.restorePlaybackState({
			currentTrack: sampleTrack1,
			queue: [],
			history: [],
			currentTime: 42,
			revision: 0,
			activeDevice
		});
		player.isPlaying = true;
		player.addToQueue(sampleTrack2);

		await vi.waitFor(() => expect(player.persistenceStatus).toBe('offline'));
		expect(player.queueCommands).toHaveLength(1);
		expect(player.currentTrack?.id).toBe('track-1');

		online = true;
		await player.syncPlaybackState();
		await vi.waitFor(() => expect(player.persistenceStatus).toBe('saved'), { timeout: 2000 });

		expect(intentBodies).toHaveLength(2);
		expect(intentBodies[1]).toMatchObject({
			origin: 'halflight-now',
			expectedRevision: 0,
			operationId: intentBodies[0]?.operationId
		});
		expect(player.queueCommands).toHaveLength(0);
		expectQueuedTracks(player, [sampleTrack2]);
		expect(player.currentTrack?.id).toBe('track-1');
		expect(player.currentTime).toBe(42);
		expect(player.isPlaying).toBe(true);
		expect(claimCalls).toBe(0);
	});

	it('refreshes a repeatedly conflicted queue without changing the audible track', async () => {
		let intentWrites = 0;
		const fetchSpy = vi.fn((url: string, init?: RequestInit) => {
			if (url === '/api/playback-state' && (!init?.method || init.method === 'GET')) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack2,
							queue: persistedQueue(sampleTrack3),
							history: [],
							currentTime: 42,
							revision: 6
						}),
						{ status: 200 }
					)
				);
			}
			if (url === '/api/playback-state') {
				return Promise.resolve(new Response(JSON.stringify({ revision: 8 }), { status: 200 }));
			}
			if (url !== '/api/playback-state/intents') return Promise.reject(new Error('offline'));
			intentWrites += 1;
			if (intentWrites === 1) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack2,
							queue: persistedQueue(sampleTrack2),
							history: [],
							currentTime: 19,
							revision: 4
						}),
						{ status: 409 }
					)
				);
			}
			if (intentWrites === 2) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack3,
							queue: persistedQueue(sampleTrack3),
							history: [],
							currentTime: 24,
							revision: 5
						}),
						{ status: 409 }
					)
				);
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						currentTrack: sampleTrack3,
						queue: [...persistedQueue(sampleTrack3), { ...sampleTrack1, entryId: 'queue-local' }],
						history: [],
						currentTime: 42,
						revision: 7
					}),
					{ status: 200 }
				)
			);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.addToQueue(sampleTrack1);

		await vi.waitFor(() => expect(player.persistenceStatus).toBe('conflict'));
		expect(player.currentTrack).toBeNull();

		await player.refreshQueueFromServer();

		expect(player.persistenceStatus).toBe('saved');
		expect(player.currentTrack).toBeNull();
		expectQueuedTracks(player, [sampleTrack3, sampleTrack1]);
		const persistenceWrites = fetchSpy.mock.calls.filter(
			([url, init]) =>
				url === '/api/playback-state/intents' &&
				(init as RequestInit | undefined)?.method === 'POST'
		);
		const refreshedWrite = JSON.parse(String(persistenceWrites[2]?.[1]?.body));
		expect(refreshedWrite).toMatchObject({
			expectedRevision: 6,
			intent: { type: 'queue.append', entries: [expect.objectContaining({ id: 'track-1' })] }
		});
	});

	it('scrobbles once after enough continuous listening time', async () => {
		const fetchSpy = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
		vi.stubGlobal('fetch', fetchSpy);
		const player = new PlayerState();
		player.currentTrack = {
			...sampleTrack1,
			duration: 100,
			album: { id: 'album', title: 'Album' }
		};
		const internal = player as unknown as {
			listenedSeconds: number;
			trackStartedAt: number;
			reportScrobbleWhenEligible: () => void;
		};
		internal.listenedSeconds = 50;
		internal.trackStartedAt = 1_700_000_000_000;

		internal.reportScrobbleWhenEligible();
		await vi.waitFor(() =>
			expect(fetchSpy).toHaveBeenCalledWith(
				'/api/lastfm/scrobble',
				expect.objectContaining({ method: 'POST' })
			)
		);
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it('dragTo clamps the floating window inside the viewport', () => {
		const player = new PlayerState();

		// Off the top-left — clamps to the 8px inset.
		player.dragTo(-500, -500, 0, 0, 1280, 800);
		expect(player.floatingPos).toEqual({ x: 8, y: 8 });

		// Off the bottom-right — clamps so a 380x92 window stays on screen.
		player.dragTo(99999, 99999, 0, 0, 1280, 800);
		expect(player.floatingPos).toEqual({ x: 1280 - 380 - 8, y: 800 - 92 - 8 });

		// Honours the grab offset, and the taller expanded height lowers the y ceiling.
		player.isExpanded = true;
		player.dragTo(600, 500, 40, 30, 1280, 1200);
		expect(player.floatingPos).toEqual({ x: 560, y: 470 });
		player.dragTo(600, 900, 40, 30, 1280, 800);
		expect(player.floatingPos).toEqual({ x: 560, y: 800 - 460 - 8 });
	});

	it('keeps mobile playback on native volume even above 100%', () => {
		const player = new PlayerState();
		player.origin = 'halflight-now';
		const internal = player as unknown as {
			engine: { applyVolume: (request: unknown) => void };
			isMobilePlayback(): boolean;
		};
		const applyVolume = vi.spyOn(internal.engine, 'applyVolume');

		expect(internal.isMobilePlayback()).toBe(true);
		player.setVolume(1.2);

		expect(applyVolume).toHaveBeenLastCalledWith({
			level: 1.2,
			muted: false,
			allowWebAudio: false
		});
	});

	it('allows the desktop gain stage only for headroom above 100%', () => {
		const player = new PlayerState();
		const internal = player as unknown as {
			engine: { applyVolume: (request: unknown) => void };
			isMobilePlayback(): boolean;
		};
		vi.spyOn(internal, 'isMobilePlayback').mockReturnValue(false);
		const applyVolume = vi.spyOn(internal.engine, 'applyVolume');

		player.setVolume(0.5);
		expect(applyVolume).toHaveBeenLastCalledWith({
			level: 0.5,
			muted: false,
			allowWebAudio: false
		});

		player.setVolume(1.2);
		expect(applyVolume).toHaveBeenLastCalledWith({ level: 1.2, muted: false, allowWebAudio: true });
	});

	it('folds ReplayGain into the level when normalisation is on', () => {
		const player = new PlayerState();
		const internal = player as unknown as {
			engine: { applyVolume: (request: unknown) => void };
		};
		const applyVolume = vi.spyOn(internal.engine, 'applyVolume');
		player.trackReplayGain = -6;

		player.setVolume(1);
		const request = applyVolume.mock.lastCall?.[0] as { level: number };
		expect(request.level).toBeCloseTo(0.501, 3);
	});
});

describe('transport availability and deliberate commands', () => {
	it('matches previous at the exact restart threshold and manual next with repeat-one', () => {
		const state = new PlayerState();
		state.currentTrack = sampleTrack1;
		state.currentTime = 3;
		expect(state.canGoPrevious).toBe(false);
		state.currentTime = 3.01;
		expect(state.canGoPrevious).toBe(true);
		state.repeatMode = 'one';
		expect(state.canGoNext).toBe(false);
		state.repeatMode = 'all';
		expect(state.canGoNext).toBe(true);
		state.activeDevice = {
			origin: 'halflight-now',
			expiresAt: new Date(Date.now() + 45000).toISOString(),
			isCurrent: false
		};
		expect(state.canGoNext).toBe(false);
		expect(state.canGoPrevious).toBe(false);
		state.duration = 200;
		expect(state.canSeek).toBe(false);
	});
	it('ignores repeat Play while loading or already playing', () => {
		const state = new PlayerState();
		state.currentTrack = sampleTrack1;
		state.isLoading = true;
		const internal = state as unknown as { engine: { init(): void; pause(): void } };
		const init = vi.spyOn(internal.engine, 'init').mockImplementation(() => {});
		state.resumePlayback();
		state.togglePlayPause();
		expect(init).not.toHaveBeenCalled();
		state.isLoading = false;
		state.isPlaying = true;
		state.resumePlayback();
		expect(state.isPlaying).toBe(true);
		expect(init).not.toHaveBeenCalled();
		init.mockRestore();
	});
	it('an explicit OS pause cancels an in-flight start and stays paused', () => {
		const state = new PlayerState();
		state.currentTrack = sampleTrack1;
		state.isLoading = true;
		const controller = new AbortController();
		const internal = state as unknown as {
			streamLoadAbort: AbortController;
			streamLoadGeneration: number;
			engine: { pause(): void };
		};
		internal.streamLoadAbort = controller;
		const generation = internal.streamLoadGeneration;
		state.pausePlayback();
		expect(controller.signal.aborted).toBe(true);
		expect(internal.streamLoadGeneration).toBe(generation + 1);
		expect(state.isPlaying).toBe(false);
		expect(state.isLoading).toBe(false);
		expect(state.currentTrack).toEqual(sampleTrack1);
	});
});
