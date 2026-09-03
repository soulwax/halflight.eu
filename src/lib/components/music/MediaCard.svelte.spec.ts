import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MediaCard from './MediaCard.svelte';

describe('MediaCard.svelte', () => {
	it('links an album to its album page and lists its artists', async () => {
		render(MediaCard, {
			item: { id: 'al1', title: 'Discovery', artists: [{ name: 'Daft Punk' }] },
			kind: 'album'
		});
		const link = page.getByRole('link', { name: /Discovery/ });
		await expect.element(link).toHaveAttribute('href', '/app/albums/al1');
		await expect.element(page.getByText('Daft Punk')).toBeInTheDocument();
	});

	it('routes an artist to the artist page and labels it', async () => {
		render(MediaCard, { item: { id: 'ar1', name: 'Justice' }, kind: 'artist' });
		await expect
			.element(page.getByRole('link', { name: /Justice/ }))
			.toHaveAttribute('href', '/app/artists/ar1');
		await expect.element(page.getByText('Artist')).toBeInTheDocument();
	});

	it('honours an explicit href override', async () => {
		render(MediaCard, {
			item: { id: 'm1', title: 'Daily Mix' },
			kind: 'mix',
			href: '/app/mixes?mixId=m1'
		});
		await expect
			.element(page.getByRole('link', { name: /Daily Mix/ }))
			.toHaveAttribute('href', '/app/mixes?mixId=m1');
	});
});
