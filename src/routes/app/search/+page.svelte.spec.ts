import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SearchResultGroups } from '#lib/tidal/models';
import SearchPage from './+page.svelte';
import type { PageData } from './$types';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

interface PendingSearch {
	url: string;
	resolve: (response: Response) => void;
}

function results(title: string): SearchResultGroups {
	return {
		tracks: [
			{
				kind: 'track',
				id: title,
				title,
				artists: [{ id: 'artist', name: 'Artist' }],
				album: { id: 'album', title: 'Album' }
			}
		],
		albums: [],
		artists: [],
		playlists: []
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('search page live search', () => {
	it('uses the URL-backed q parameter and ignores an older result', async () => {
		const pending: PendingSearch[] = [];
		const fetchMock = vi.fn(
			(url: string) =>
				new Promise<Response>((resolve) => {
					pending.push({ url, resolve });
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		render(SearchPage, {
			data: { query: '', connected: true, results: null, error: null } as PageData
		});

		const input = page.getByRole('searchbox', { name: 'Search' });
		await input.fill('first');
		await vi.waitFor(() => expect(pending).toHaveLength(1));
		await input.fill('second');
		await vi.waitFor(() => expect(pending).toHaveLength(2));

		expect(pending[0]?.url).toContain('?q=first');
		expect(pending[1]?.url).toContain('?q=second');

		pending[1]?.resolve(new Response(JSON.stringify({ results: results('Second choice') })));
		await expect.element(page.getByText('Second choice')).toBeInTheDocument();

		pending[0]?.resolve(new Response(JSON.stringify({ results: results('First choice') })));
		await expect.element(page.getByText('Second choice')).toBeInTheDocument();
		await expect.element(page.getByText('First choice')).not.toBeInTheDocument();
	});
});
