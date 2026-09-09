import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrackActionMenu from './TrackActionMenu.svelte';
import { player } from '#lib/player/player.svelte.js';
import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const sampleTrack: TrackSummary = {
	kind: 'track',
	id: 'trk-100',
	title: 'Atmosphere',
	artists: [{ id: 'art-2', name: 'Joy Division' }],
	duration: 250
};

describe('TrackActionMenu.svelte', () => {
	beforeEach(() => {
		player.clearQueue();
		customPlaylists.closeAddToPlaylist();
	});

	it('renders trigger button with accessible label', async () => {
		render(TrackActionMenu, { track: sampleTrack });
		const trigger = page.getByRole('button', { name: m.track_action_menu() });
		await expect.element(trigger).toBeInTheDocument();
	});

	it('opens menu and exposes all five actions on click', async () => {
		render(TrackActionMenu, { track: sampleTrack });
		const trigger = page.getByRole('button', { name: m.track_action_menu() });
		await trigger.click();

		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_play_now() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_play_next() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_add_to_queue() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_start_radio() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: m.track_action_add_to_playlist() }))
			.toBeInTheDocument();
	});

	it('adds to queue when add to queue item is selected', async () => {
		render(TrackActionMenu, { track: sampleTrack });
		const trigger = page.getByRole('button', { name: m.track_action_menu() });
		await trigger.click();

		const queueItem = page.getByRole('menuitem', { name: m.track_action_add_to_queue() });
		await queueItem.click();

		expect(player.queue).toHaveLength(1);
		expect(player.queue[0]?.id).toBe(sampleTrack.id);
	});

	it('prompts add to playlist when playlist item is selected', async () => {
		const promptSpy = vi.spyOn(customPlaylists, 'promptAddToPlaylist');
		render(TrackActionMenu, { track: sampleTrack });
		const trigger = page.getByRole('button', { name: m.track_action_menu() });
		await trigger.click();

		const playlistItem = page.getByRole('menuitem', { name: m.track_action_add_to_playlist() });
		await playlistItem.click();

		expect(promptSpy).toHaveBeenCalledWith(sampleTrack);
	});
});
