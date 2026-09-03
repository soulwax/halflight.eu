import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PageActions from './PageActions.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('PageActions.svelte', () => {
	it('always renders a back-to-search link', async () => {
		render(PageActions, {});
		await expect
			.element(page.getByRole('link', { name: m.track_back_to_search() }))
			.toHaveAttribute('href', '/app/search');
	});

	it('adds a TIDAL link and a retry link when their hrefs are supplied', async () => {
		render(PageActions, {
			tidalUrl: 'https://tidal.com/browse/album/9',
			retryHref: '/app/albums/9'
		});
		await expect
			.element(page.getByRole('link', { name: new RegExp(m.album_open_in_tidal()) }))
			.toHaveAttribute('href', 'https://tidal.com/browse/album/9');
		await expect
			.element(page.getByRole('link', { name: m.track_retry() }))
			.toHaveAttribute('href', '/app/albums/9');
	});
});
