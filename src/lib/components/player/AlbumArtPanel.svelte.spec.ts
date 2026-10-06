import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AlbumArtPanel from './AlbumArtPanel.svelte';
import type { TrackSummary } from '#lib/tidal/models';

const imageUrl =
	'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Autobahn',
	artists: [],
	album: { id: 'al1', title: 'Autobahn', imageUrl }
};

describe('AlbumArtPanel.svelte', () => {
	it('renders the large cover with descriptive alt text', async () => {
		render(AlbumArtPanel, { track });
		const img = page.getByRole('img', { name: 'Cover for Autobahn' });
		await expect.element(img).toBeInTheDocument();
		expect(img.element().getAttribute('src')).toBe(imageUrl);
	});

	it('shows a fallback when there is no artwork', async () => {
		render(AlbumArtPanel, {
			track: { ...track, id: 'private-file', album: { id: 'al1', title: 'Autobahn' } }
		});
		await expect.element(page.getByRole('img')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});
	it('tries the new track cover after the previous image failed', async () => {
		const view = render(AlbumArtPanel, { track });
		const image = page.getByRole('img', { name: 'Cover for Autobahn' });
		await expect.element(image).toBeInTheDocument();
		image.element().dispatchEvent(new Event('error'));
		await expect.element(page.getByRole('img')).not.toBeInTheDocument();
		await view.rerender({
			track: { ...track, title: 'Next track', imageUrl: `${imageUrl}#next` }
		});
		await expect
			.element(page.getByRole('img', { name: 'Cover for Next track' }))
			.toBeInTheDocument();
	});
});
