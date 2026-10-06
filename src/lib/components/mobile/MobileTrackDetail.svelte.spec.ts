import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileTrackDetail from './MobileTrackDetail.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackDetail } from '#lib/tidal/models';

const navigation = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
vi.mock('$app/navigation', () => navigation);
beforeEach(() => {
	navigation.invalidateAll.mockReset().mockResolvedValue(undefined);
	player.currentTrack = null;
	player.queue = [];
});

const track: TrackDetail = {
	kind: 'track',
	id: 't1',
	title: 'Bela Lugosi Is Dead',
	duration: 559,
	audioQuality: 'LOSSLESS',
	artists: [{ id: 'ar1', name: 'Bauhaus' }],
	album: { id: 'al1', title: 'Press the Eject', releaseDate: '1982-01-01' }
};

afterEach(() => {
	vi.restoreAllMocks();
	player.currentTrack = null;
	player.queue = [];
});

describe('MobileTrackDetail.svelte', () => {
	it('retries failed track data while keeping the current session', async () => {
		const current = { kind: 'track' as const, id: 'current', title: 'Still playing', artists: [] };
		player.currentTrack = current;
		player.currentTime = 37;
		player.addToQueue(current);
		const queue = [...player.queue];
		render(MobileTrackDetail, { track: null, state: 'unavailable' });
		await page.getByRole('button', { name: m.track_retry() }).click();
		expect(navigation.invalidateAll).toHaveBeenCalledOnce();
		expect(player.currentTrack).toEqual(current);
		expect(player.currentTime).toBe(37);
		expect(player.queue).toEqual(queue);
	});

	it('shows the track with links to its artist and album', async () => {
		render(MobileTrackDetail, { track, state: null });

		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Bela Lugosi Is Dead' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Bauhaus' }))
			.toHaveAttribute('href', '/artists/ar1');
		await expect
			.element(page.getByRole('link', { name: 'Press the Eject' }))
			.toHaveAttribute('href', '/albums/al1');
	});

	it('plays just this track from the primary action', async () => {
		const play = vi.spyOn(player, 'play').mockImplementation(() => {});
		render(MobileTrackDetail, { track, state: null });

		// `exact` — the accessible name "Play" is also a prefix of "Play next".
		await page.getByRole('button', { name: m.player_play_track(), exact: true }).click();

		expect(play).toHaveBeenCalledWith(track);
	});

	it('queues the track without replacing the session', async () => {
		const addToQueue = vi.spyOn(player, 'addToQueue').mockImplementation(() => {});
		render(MobileTrackDetail, { track, state: null });

		await page.getByRole('button', { name: m.track_action_menu() }).click();
		await page
			.getByRole('dialog')
			.getByRole('button', { name: m.track_action_add_to_queue() })
			.click();

		expect(addToQueue).toHaveBeenCalledWith(track, undefined);
	});

	it('disables radio without a radio neighbourhood', async () => {
		render(MobileTrackDetail, { track, state: null });

		await page.getByRole('button', { name: m.track_action_menu() }).click();
		await expect
			.element(page.getByRole('dialog').getByRole('button', { name: m.track_action_start_radio() }))
			.toBeDisabled();
	});

	it('keeps the detail page primary action singular', async () => {
		render(MobileTrackDetail, { track, state: null });

		await page.getByRole('button', { name: m.track_action_menu() }).click();
		await expect
			.element(page.getByRole('dialog').getByRole('button', { name: m.track_action_play_now() }))
			.not.toBeInTheDocument();
	});

	it('explains a missing track', async () => {
		render(MobileTrackDetail, { track: null, state: 'not_found' });

		await expect.element(page.getByText(m.now_track_not_found())).toBeInTheDocument();
	});
});
