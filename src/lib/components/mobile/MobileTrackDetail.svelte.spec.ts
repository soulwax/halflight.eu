import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileTrackDetail from './MobileTrackDetail.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackDetail } from '#lib/tidal/models';

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
});

describe('MobileTrackDetail.svelte', () => {
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

		await page.getByRole('button', { name: m.player_play_track() }).click();

		expect(play).toHaveBeenCalledWith(track);
	});

	it('queues the track without replacing the session', async () => {
		const addToQueue = vi.spyOn(player, 'addToQueue').mockImplementation(() => {});
		render(MobileTrackDetail, { track, state: null });

		await page.getByRole('button', { name: m.player_add_to_queue() }).click();

		expect(addToQueue).toHaveBeenCalledWith(track);
	});

	it('disables radio without a radio neighbourhood', async () => {
		render(MobileTrackDetail, { track, state: null });

		await expect.element(page.getByRole('button', { name: m.player_start_radio() })).toBeDisabled();
	});

	it('explains a missing track', async () => {
		render(MobileTrackDetail, { track: null, state: 'not_found' });

		await expect.element(page.getByText(m.now_track_not_found())).toBeInTheDocument();
	});
});
