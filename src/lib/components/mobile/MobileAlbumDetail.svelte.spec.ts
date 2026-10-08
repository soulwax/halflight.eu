import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileAlbumDetail from './MobileAlbumDetail.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { AlbumDetail } from '#lib/tidal/models';

const navigation = vi.hoisted(() => ({ invalidateAll: vi.fn(), goto: vi.fn() }));
vi.mock('$app/navigation', () => navigation);
beforeEach(() => {
	navigation.invalidateAll.mockReset().mockResolvedValue(undefined);
	player.currentTrack = null;
	player.queue = [];
});

const items = [
	{ kind: 'track', id: 't1', title: 'Dark Entries', artists: [{ id: 'a1', name: 'Bauhaus' }] },
	{
		kind: 'track',
		id: 't2',
		title: 'Terror Couple Kill Colonel',
		artists: [{ id: 'a1', name: 'Bauhaus' }]
	}
] satisfies AlbumDetail['items'];

const album: AlbumDetail = {
	kind: 'album',
	id: 'al1',
	title: 'In the Flat Field',
	artists: [{ id: 'a1', name: 'Bauhaus' }],
	releaseDate: '1980-11-01',
	items
};

afterEach(() => {
	vi.restoreAllMocks();
	player.currentTrack = null;
	player.queue = [];
	player.shuffle = false;
});

describe('MobileAlbumDetail.svelte', () => {
	it('renders repeated recordings and starts the tapped occurrence', async () => {
		const repeated = [items[0], items[1], items[0]];
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileAlbumDetail, { album: { ...album, items: repeated }, state: null });
		const rows = page.getByRole('button', { name: /Dark Entries Bauhaus/ });
		await expect.element(rows.nth(1)).toBeInTheDocument();
		await rows.nth(1).click();
		expect(play).toHaveBeenCalledWith(items[0], repeated, `${m.album_label()} · ${album.title}`, 2);
	});

	it('retries failed album data while keeping the current session', async () => {
		const current = { kind: 'track' as const, id: 'current', title: 'Still playing', artists: [] };
		player.currentTrack = current;
		player.currentTime = 37;
		player.addToQueue(current);
		const queue = [...player.queue];
		render(MobileAlbumDetail, { album: null, state: 'unavailable' });
		await page.getByRole('button', { name: m.track_retry() }).click();
		expect(navigation.invalidateAll).toHaveBeenCalledOnce();
		expect(player.currentTrack).toEqual(current);
		expect(player.currentTime).toBe(37);
		expect(player.queue).toEqual(queue);
	});

	it('shows the album identity and its tracks', async () => {
		render(MobileAlbumDetail, { album, state: null });

		await expect
			.element(page.getByRole('heading', { level: 1, name: 'In the Flat Field' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Bauhaus').first()).toBeInTheDocument();
		await expect.element(page.getByText('Dark Entries')).toBeInTheDocument();
		await expect.element(page.getByText('Terror Couple Kill Colonel')).toBeInTheDocument();
	});

	it('plays the whole album in context from the primary action', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileAlbumDetail, { album, state: null });

		await page.getByRole('button', { name: m.player_play_all() }).click();

		expect(play).toHaveBeenCalledWith(items[0], items, `${m.album_label()} · ${album.title}`);
	});

	it('turns on shuffle before playing when shuffling the album', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileAlbumDetail, { album, state: null });

		await page.getByRole('button', { name: m.now_album_shuffle() }).click();

		expect(player.shuffle).toBe(true);
		expect(play).toHaveBeenCalledOnce();
		const [, context] = play.mock.calls[0];
		expect(context).toEqual(items);
	});

	it('offers a reconnect path when TIDAL is disconnected', async () => {
		render(MobileAlbumDetail, { album: null, state: 'not_connected' });

		await expect.element(page.getByText(m.now_album_disconnected())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.tidal_connect() }))
			.toHaveAttribute('href', '/settings');
	});

	it('explains a missing album', async () => {
		render(MobileAlbumDetail, { album: null, state: 'not_found' });

		await expect.element(page.getByText(m.now_album_not_found())).toBeInTheDocument();
	});
});
