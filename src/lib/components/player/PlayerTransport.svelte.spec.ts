import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayerTransport from './PlayerTransport.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';
import { createQueueEntry } from '#lib/player/queue-entry.js';

const track: TrackSummary = {
	kind: 'track',
	id: 'transport-track',
	title: 'Transport Track',
	artists: [{ id: 'artist-1', name: 'Artist One' }]
};

beforeEach(() => {
	player.repeatMode = 'off';
	player.isLoading = false;
	player.playbackMode = 'direct';
	player.activeDevice = null;
});

afterEach(() => {
	player.isPlaying = false;
	player.isLoading = false;
	player.playbackMode = 'direct';
	player.activeDevice = null;
	player.shuffle = false;
	player.repeatMode = 'off';
	player.currentTrack = null;
	player.currentTime = 0;
	player.queue = [];
	player.history = [];
	vi.restoreAllMocks();
});

describe('PlayerTransport.svelte', () => {
	it('exposes shuffle, previous, play, next and repeat controls', async () => {
		render(PlayerTransport);
		for (const name of [
			m.player_shuffle(),
			m.player_previous(),
			m.player_next(),
			m.player_repeat_off()
		]) {
			await expect.element(page.getByRole('button', { name })).toBeInTheDocument();
		}
	});

	it('toggles shuffle state through the player when clicked', async () => {
		player.shuffle = false;
		render(PlayerTransport);
		(page.getByRole('button', { name: m.player_shuffle() }).element() as HTMLButtonElement).click();
		expect(player.shuffle).toBe(true);
	});

	it('names the central control after the audio action it performs', async () => {
		player.isPlaying = false;
		render(PlayerTransport);
		await expect
			.element(page.getByRole('button', { name: m.player_play_track() }))
			.toBeInTheDocument();

		player.isPlaying = true;
		await expect.element(page.getByRole('button', { name: m.player_pause() })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_collapse() }))
			.not.toBeInTheDocument();
	});

	it('routes previous, play/pause, and next clicks to the player state', async () => {
		player.currentTrack = track;
		player.queue = [createQueueEntry({ ...track, id: 'next-track', title: 'Next Track' })];
		player.currentTime = 4;
		const previous = vi.spyOn(player, 'previous').mockReturnValue(track);
		const togglePlayPause = vi.spyOn(player, 'togglePlayPause').mockImplementation(() => {});
		const next = vi.spyOn(player, 'next').mockReturnValue(track);

		render(PlayerTransport);

		(
			page.getByRole('button', { name: m.player_previous() }).element() as HTMLButtonElement
		).click();
		(
			page.getByRole('button', { name: m.player_play_track() }).element() as HTMLButtonElement
		).click();
		(page.getByRole('button', { name: m.player_next() }).element() as HTMLButtonElement).click();

		expect(previous).toHaveBeenCalledOnce();
		expect(togglePlayPause).toHaveBeenCalledOnce();
		expect(next).toHaveBeenCalledOnce();
	});

	it('skips to the queued song when Next is pressed', async () => {
		player.currentTrack = track;
		player.queue = [createQueueEntry({ ...track, id: 'queued-track', title: 'Queued Track' })];

		render(PlayerTransport);
		(page.getByRole('button', { name: m.player_next() }).element() as HTMLButtonElement).click();

		expect(player.currentTrack?.id).toBe('queued-track');
		expect(player.queue).toHaveLength(0);
		expect(player.history.map((item) => item.id)).toContain(track.id);
	});

	it('cycles repeat mode through all, one, and off from the transport', async () => {
		render(PlayerTransport);
		await page.getByRole('button', { name: m.player_repeat_off() }).click();
		expect(player.repeatMode).toBe('all');
		await page.getByRole('button', { name: m.player_repeat_all() }).click();
		expect(player.repeatMode).toBe('one');
		await page.getByRole('button', { name: m.player_repeat_one() }).click();
		expect(player.repeatMode).toBe('off');
	});
});
