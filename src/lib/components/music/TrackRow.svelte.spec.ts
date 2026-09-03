import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrackRow from './TrackRow.svelte';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '101',
	title: 'Bela Lugosi Is Dead',
	duration: 576,
	explicit: true,
	trackNumber: 3,
	artists: [{ id: 'a1', name: 'Bauhaus' }]
};

describe('TrackRow.svelte', () => {
	it('links the title to the track page and shows the formatted duration', async () => {
		render(TrackRow, { track });
		await expect
			.element(page.getByRole('link', { name: 'Bela Lugosi Is Dead' }))
			.toHaveAttribute('href', '/app/tracks/101');
		await expect.element(page.getByText('9:36')).toBeInTheDocument();
	});

	it('marks explicit tracks and exposes play / queue / playlist actions', async () => {
		render(TrackRow, { track });
		await expect.element(page.getByTitle('Explicit')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_play_track(), exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.player_add_to_queue() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.action_add_to_custom_playlist() }))
			.toBeInTheDocument();
	});

	it('hides the artist line when it only repeats the parent artist', async () => {
		render(TrackRow, { track: { ...track, explicit: false }, parentArtistName: 'Bauhaus' });
		await expect.element(page.getByRole('link', { name: 'Bauhaus' })).not.toBeInTheDocument();
	});
});
