import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileArtistDetail from './MobileArtistDetail.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { ArtistDetail } from '#lib/tidal/models';

const topTracks = [
	{ kind: 'track', id: 't1', title: 'Dark Entries', artists: [{ id: 'a1', name: 'Bauhaus' }] },
	{ kind: 'track', id: 't2', title: 'Kick in the Eye', artists: [{ id: 'a1', name: 'Bauhaus' }] }
] satisfies ArtistDetail['topTracks'];

const artist: ArtistDetail = {
	kind: 'artist',
	id: 'a1',
	name: 'Bauhaus',
	topTracks,
	albums: [{ kind: 'album', id: 'al1', title: 'In the Flat Field', artists: [] }],
	similarArtists: []
};

afterEach(() => {
	vi.restoreAllMocks();
	player.shuffle = false;
});

describe('MobileArtistDetail.svelte', () => {
	it('shows the artist, top tracks, and albums', async () => {
		render(MobileArtistDetail, { artist, state: null });

		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Bauhaus' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Dark Entries')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'In the Flat Field' }))
			.toHaveAttribute('href', '/albums/al1');
	});

	it('plays the top tracks in context from the primary action', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileArtistDetail, { artist, state: null });

		await page.getByRole('button', { name: m.player_play_all() }).click();

		expect(play).toHaveBeenCalledWith(topTracks[0], topTracks, `${m.artist_label()} · Bauhaus`);
	});

	it('disables radio when the artist has no radio tracks', async () => {
		render(MobileArtistDetail, { artist, state: null });

		await expect.element(page.getByRole('button', { name: m.player_start_radio() })).toBeDisabled();
	});

	it('offers a reconnect path when TIDAL is disconnected', async () => {
		render(MobileArtistDetail, { artist: null, state: 'not_connected' });

		await expect.element(page.getByText(m.now_artist_disconnected())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.tidal_connect() }))
			.toHaveAttribute('href', '/settings');
	});

	it('explains a missing artist', async () => {
		render(MobileArtistDetail, { artist: null, state: 'not_found' });

		await expect.element(page.getByText(m.now_artist_not_found())).toBeInTheDocument();
	});
});
