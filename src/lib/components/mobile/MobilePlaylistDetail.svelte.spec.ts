import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobilePlaylistDetail from './MobilePlaylistDetail.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { PlaylistDetail } from '#lib/tidal/models';

const items = [
	{
		kind: 'track',
		id: 't1',
		title: 'Bela Lugosi Is Dead',
		artists: [{ id: 'a1', name: 'Bauhaus' }]
	},
	{ kind: 'track', id: 't2', title: 'Dark Entries', artists: [{ id: 'a1', name: 'Bauhaus' }] }
] satisfies PlaylistDetail['items'];

const playlist: PlaylistDetail = {
	kind: 'playlist',
	id: 'pl1',
	title: 'Night Shift',
	description: 'for the small hours',
	creator: { name: 'You' },
	numberOfItems: 2,
	items
};

afterEach(() => {
	vi.restoreAllMocks();
	player.shuffle = false;
});

describe('MobilePlaylistDetail.svelte', () => {
	it('shows the playlist identity, description, and its tracks', async () => {
		render(MobilePlaylistDetail, { playlist, state: null });

		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Night Shift' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('for the small hours')).toBeInTheDocument();
		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
		await expect.element(page.getByText('Dark Entries')).toBeInTheDocument();
	});

	it('plays the whole playlist in context from the primary action', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobilePlaylistDetail, { playlist, state: null });

		await page.getByRole('button', { name: m.player_play_all() }).click();

		expect(play).toHaveBeenCalledWith(items[0], items, 'Night Shift');
	});

	it('turns on shuffle before playing when shuffling the playlist', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobilePlaylistDetail, { playlist, state: null });

		await page.getByRole('button', { name: m.now_playlist_shuffle() }).click();

		expect(player.shuffle).toBe(true);
		expect(play).toHaveBeenCalledOnce();
	});

	it('offers a reconnect path when TIDAL is disconnected', async () => {
		render(MobilePlaylistDetail, { playlist: null, state: 'not_connected' });

		await expect.element(page.getByText(m.now_playlist_disconnected())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.tidal_connect() }))
			.toHaveAttribute('href', '/settings');
	});

	it('explains a missing playlist', async () => {
		render(MobilePlaylistDetail, { playlist: null, state: 'not_found' });

		await expect.element(page.getByText(m.now_playlist_not_found())).toBeInTheDocument();
	});
});
