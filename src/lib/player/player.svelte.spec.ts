import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerState } from './player.svelte';
import type { TrackSummary } from '#lib/tidal/models';

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

describe('PlayerState', () => {
	it('plays a track and slices remaining context tracks into the queue', () => {
		const player = new PlayerState();
		player.play(sampleTrack2, [sampleTrack1, sampleTrack2, sampleTrack3]);

		expect(player.currentTrack).toEqual(sampleTrack2);
		expect(player.queue).toEqual([sampleTrack3]);
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

	it('adds tracks to queue and removes by index', () => {
		const player = new PlayerState();
		player.addToQueue(sampleTrack1);
		player.addToQueue(sampleTrack2);
		expect(player.queueCount).toBe(2);

		player.removeFromQueue(0);
		expect(player.queue).toEqual([sampleTrack2]);

		player.clearQueue();
		expect(player.queue).toEqual([]);
	});

	it('inserts a track next while retaining its source provenance', () => {
		const player = new PlayerState();
		player.addToQueue(sampleTrack2, 'Search');
		player.playNext(sampleTrack1, 'Album · Discovery');

		expect(player.queue).toEqual([
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
		expect(player.queue).toEqual([sampleTrack3]);
		expect(player.hasPrevious).toBe(true);

		const prev = player.previous();
		expect(prev).toEqual(sampleTrack1);
		expect(player.currentTrack).toEqual(sampleTrack1);
		expect(player.queue).toEqual([sampleTrack2, sampleTrack3]);
	});

	it('plays directly from queue', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.addToQueue(sampleTrack3);

		player.playFromQueue(1);
		expect(player.currentTrack).toEqual(sampleTrack3);
		expect(player.queue).toEqual([sampleTrack2]);
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
			queue: [sampleTrack2],
			history: [sampleTrack3],
			currentTime: 67.8
		});

		expect(player.currentTrack).toEqual(sampleTrack1);
		expect(player.queue).toEqual([sampleTrack2]);
		expect(player.history).toEqual([sampleTrack3]);
		expect(player.currentTime).toBe(67);
		expect(player.isPlaying).toBe(false);
	});

	it('reorders queued tracks with moveQueueItem', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addMultipleToQueue([sampleTrack2, sampleTrack3]);

		player.moveQueueItem(1, -1);
		expect(player.queue).toEqual([sampleTrack3, sampleTrack2]);
		player.moveQueueItem(0, -1); // no-op at the top edge
		expect(player.queue).toEqual([sampleTrack3, sampleTrack2]);
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
		expect(player.queue).toEqual([sampleTrack2]);
	});

	it('repeat-all refills the queue from history once it empties', () => {
		const player = new PlayerState();
		player.play(sampleTrack1);
		player.addToQueue(sampleTrack2);
		player.cycleRepeat(); // -> all

		player.next(); // -> track2, history [track1], queue []
		const looped = player.next(); // queue empty + repeat all -> refill
		expect(looped).toEqual(sampleTrack1);
		expect(player.queue).toEqual([sampleTrack2]);
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

	it('backfills missing artwork through the cover endpoint', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				if (String(url).endsWith('/cover')) {
					return Promise.resolve(
						new Response(JSON.stringify({ imageUrl: 'https://img.test/c.jpg', album: null }), {
							status: 200
						})
					);
				}
				return Promise.reject(new Error('offline'));
			})
		);

		const player = new PlayerState();
		player.play({ ...sampleTrack1, imageUrl: undefined });

		await vi.waitFor(() => expect(player.currentTrack?.imageUrl).toBe('https://img.test/c.jpg'));
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
			if (String(url) === '/api/playback-state') {
				return Promise.resolve(new Response(JSON.stringify({ revision: 1 }), { status: 200 }));
			}
			return Promise.reject(new Error('offline'));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.origin = 'halflight-now';
		player.addToQueue(sampleTrack1);

		await vi.waitFor(
			() => expect(fetchSpy).toHaveBeenCalledWith('/api/playback-state', expect.anything()),
			{ timeout: 2000 }
		);
		const call = fetchSpy.mock.calls.find(([url]) => String(url) === '/api/playback-state');
		const body = JSON.parse(String(call?.[1]?.body));
		expect(body.origin).toBe('halflight-now');
	});

	it('serializes a changed queue behind an in-flight persistence write', async () => {
		let resolveFirst: ((response: Response) => void) | undefined;
		const firstResponse = new Promise<Response>((resolve) => {
			resolveFirst = resolve;
		});
		let persistenceCalls = 0;
		const fetchSpy = vi.fn((url: string, _init?: RequestInit) => {
			if (url !== '/api/playback-state') return Promise.reject(new Error('offline'));
			persistenceCalls += 1;
			return persistenceCalls === 1
				? firstResponse
				: Promise.resolve(new Response(JSON.stringify({ revision: 2 }), { status: 200 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.addToQueue(sampleTrack1);
		await vi.waitFor(() => expect(persistenceCalls).toBe(1));

		player.addToQueue(sampleTrack2);
		resolveFirst?.(new Response(JSON.stringify({ revision: 1 }), { status: 200 }));

		await vi.waitFor(() => expect(persistenceCalls).toBe(2));
		const persistenceWrites = fetchSpy.mock.calls.filter(([url]) => url === '/api/playback-state');
		const secondBody = JSON.parse(String(persistenceWrites[1]?.[1]?.body));
		expect(secondBody).toMatchObject({
			revision: 1,
			queue: [
				expect.objectContaining({ id: 'track-1' }),
				expect.objectContaining({ id: 'track-2' })
			]
		});
	});

	it('rebases a stale local queue edit and retries without interrupting playback', async () => {
		let persistenceCalls = 0;
		const fetchSpy = vi.fn((url: string, _init?: RequestInit) => {
			if (url !== '/api/playback-state') return Promise.reject(new Error('offline'));
			persistenceCalls += 1;
			return persistenceCalls === 1
				? Promise.resolve(
						new Response(
							JSON.stringify({
								currentTrack: sampleTrack2,
								queue: [sampleTrack2],
								history: [],
								currentTime: 19,
								revision: 4
							}),
							{ status: 409 }
						)
					)
				: Promise.resolve(new Response(JSON.stringify({ revision: 5 }), { status: 200 }));
		});
		vi.stubGlobal('fetch', fetchSpy);

		const player = new PlayerState();
		player.restorePlaybackState({ currentTrack: null, queue: [], history: [], currentTime: 0 });
		player.addToQueue(sampleTrack1);

		await vi.waitFor(() => expect(player.persistenceStatus).toBe('saved'));
		expect(persistenceCalls).toBe(2);
		expect(player.currentTrack).toBeNull();
		expect(player.queue).toEqual([sampleTrack2, sampleTrack1]);
		const writes = fetchSpy.mock.calls.filter(([url]) => url === '/api/playback-state');
		const retry = JSON.parse(String(writes[1]?.[1]?.body));
		expect(retry).toMatchObject({ revision: 4, queue: [sampleTrack2, sampleTrack1] });
	});

	it('refreshes a repeatedly conflicted queue without changing the audible track', async () => {
		let writes = 0;
		const fetchSpy = vi.fn((url: string, init?: RequestInit) => {
			if (url !== '/api/playback-state') return Promise.reject(new Error('offline'));
			if (!init?.method || init.method === 'GET') {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack2,
							queue: [sampleTrack3],
							history: [],
							currentTime: 42,
							revision: 6
						}),
						{ status: 200 }
					)
				);
			}
			writes += 1;
			if (writes === 1) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack2,
							queue: [sampleTrack2],
							history: [],
							currentTime: 19,
							revision: 4
						}),
						{ status: 409 }
					)
				);
			}
			if (writes === 2) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							currentTrack: sampleTrack3,
							queue: [sampleTrack3],
							history: [],
							currentTime: 24,
							revision: 5
						}),
						{ status: 409 }
					)
				);
			}
			return Promise.resolve(new Response(JSON.stringify({ revision: 7 }), { status: 200 }));
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
		expect(player.queue).toEqual([sampleTrack3, sampleTrack1]);
		const persistenceWrites = fetchSpy.mock.calls.filter(
			([url, init]) =>
				url === '/api/playback-state' && (init as RequestInit | undefined)?.method === 'PUT'
		);
		const refreshedWrite = JSON.parse(String(persistenceWrites[2]?.[1]?.body));
		expect(refreshedWrite).toMatchObject({
			revision: 6,
			queue: [sampleTrack3, sampleTrack1]
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
});
