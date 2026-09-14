import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowPlaying from './NowPlaying.svelte';
import type { TrackSummary } from '#lib/tidal/models';

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
	it('shows linked track context without turning artwork into a second transport control', async () => {
		render(NowPlaying, { track });

		const title = page.getByRole('link', { name: 'Bela Lugosi Is Dead' });
		await expect.element(title).toBeInTheDocument();
		expect(title.element().getAttribute('href')).toBe('/app/tracks/9');
		await expect.element(page.getByText('Bauhaus')).toBeInTheDocument();
		await expect.element(page.getByText('Press the Eject · 1982')).toBeInTheDocument();
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});
});
