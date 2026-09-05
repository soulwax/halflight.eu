import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SongCard from './SongCard.svelte';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '55',
	title: 'Get Lucky',
	duration: 248,
	audioQuality: 'HI_RES_LOSSLESS',
	artists: [
		{ id: 'a1', name: 'Daft Punk' },
		{ id: 'a2', name: 'Pharrell Williams' }
	],
	album: { id: 'al1', title: 'Random Access Memories', releaseDate: '2013-05-17' }
};

describe('SongCard.svelte', () => {
	it('shows title, artists, album year, quality and duration', async () => {
		render(SongCard, { track: { ...track, explicit: true } });
		await expect
			.element(page.getByRole('link', { name: 'Get Lucky' }))
			.toHaveAttribute('href', '/app/tracks/55');
		await expect.element(page.getByRole('link', { name: 'Daft Punk' })).toBeInTheDocument();
		await expect.element(page.getByText('(2013)')).toBeInTheDocument();
		await expect.element(page.getByText('HI RES LOSSLESS')).toHaveAttribute('data-tier', 'hires');
		await expect.element(page.getByText('4:08')).toBeInTheDocument();
		await expect.element(page.getByTitle(m.track_badge_explicit())).toBeInTheDocument();
	});

	it('exposes play, play-next, queue, radio and add-to-playlist actions', async () => {
		render(SongCard, { track });
		await expect
			.element(page.getByRole('button', { name: m.player_play_track(), exact: true }).first())
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_play_next() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_add_to_queue() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_start_radio() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.action_add_to_custom_playlist() }))
			.toBeInTheDocument();
	});
});
