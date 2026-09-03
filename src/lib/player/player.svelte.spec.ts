import { describe, expect, it } from 'vitest';
import { PlayerState } from './player.svelte';
import type { TrackSummary } from '#lib/server/tidal/models';

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
});
