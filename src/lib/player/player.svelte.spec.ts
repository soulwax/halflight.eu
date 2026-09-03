import { beforeEach, describe, expect, it } from 'vitest';
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
});
