import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowPlaying from './NowPlaying.svelte';
import type { TrackSummary } from '#lib/tidal/models';
import { m } from '#lib/paraglide/messages.js';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	artists: [{ id: 'a1', name: 'Bauhaus' }],
	album: {
		id: 'al1',
		title: 'Press the Eject',
		releaseDate: '1982-01-01',
		imageUrl: 'https://img.test/cover.jpg'
	}
};

describe('NowPlaying.svelte', () => {
	it('opens player context from the title without linking to catalogue detail', async () => {
		render(NowPlaying, { track });

		const title = page.getByRole('button', { name: m.player_now_playing() });
		await expect.element(title).toBeInTheDocument();
		await expect.element(title).toHaveTextContent('Bela Lugosi Is Dead');
		await expect.element(page.getByText('Bauhaus')).toBeInTheDocument();
		await expect.element(page.getByText('Press the Eject · 1982')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Bela Lugosi Is Dead' }))
			.not.toBeInTheDocument();
	});
});
