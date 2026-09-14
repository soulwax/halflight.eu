import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AlbumArtPanel from './AlbumArtPanel.svelte';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Autobahn',
	artists: [],
	album: { id: 'al1', title: 'Autobahn', imageUrl: 'https://img.test/a.jpg' }
};

describe('AlbumArtPanel.svelte', () => {
	it('renders the large cover with descriptive alt text', async () => {
		render(AlbumArtPanel, { track });
		const img = page.getByRole('img', { name: 'Cover for Autobahn' });
		await expect.element(img).toBeInTheDocument();
		expect(img.element().getAttribute('src')).toBe('https://img.test/a.jpg');
	});

	it('shows a fallback when there is no artwork', async () => {
		render(AlbumArtPanel, { track: { ...track, album: { id: 'al1', title: 'Autobahn' } } });
		await expect.element(page.getByRole('img')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});
});
