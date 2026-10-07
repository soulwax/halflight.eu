import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import LibraryPage from './+page.svelte';
import type { PageData } from './$types';

const data = {
	connected: false,
	sections: null,
	savedUnavailable: false,
	privateMusicUnavailable: false,
	savedPlaylists: [
		{
			id: 'saved',
			title: 'After midnight',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			items: [
				{ kind: 'track', id: '1', title: 'Night Drive', artists: [{ id: 'a', name: 'Artist' }] }
			]
		}
	],
	privateMusic: {
		enabled: false,
		formats: [],
		files: [],
		storage: {
			fileCount: 0,
			usedBytes: 0,
			availableBytes: 512 * 1024 ** 2,
			maxTotalBytes: 512 * 1024 ** 2,
			maxFileBytes: 128 * 1024 ** 2
		}
	}
} as unknown as PageData;

describe('desktop library views', () => {
	it('shows saved playlists first and opens private music as its own view', async () => {
		render(LibraryPage, { data });
		await expect.element(page.getByText('After midnight')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: m.private_music_title() }))
			.not.toBeInTheDocument();
		await page.getByRole('button', { name: m.library_view_private(), exact: true }).click();
		await expect
			.element(page.getByRole('heading', { name: m.private_music_title() }))
			.toBeInTheDocument();
	});
	it('finds a saved playlist by a song and clears an empty match', async () => {
		render(LibraryPage, { data });
		const input = page.getByRole('searchbox', { name: m.library_filter_label() });
		await input.fill('Night Drive');
		await expect.element(page.getByText('After midnight')).toBeInTheDocument();
		await input.fill('no match');
		await expect
			.element(page.getByText(m.library_no_matches({ query: 'no match' })))
			.toBeInTheDocument();
		await page.getByRole('button', { name: m.search_clear() }).click();
		await expect.element(page.getByText('After midnight')).toBeInTheDocument();
	});
});
