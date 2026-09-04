import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		search: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { search: mocks.search }
}));

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function event(urlStr: string, user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		url: new URL(urlStr),
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/search', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.search.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(GET(event('http://localhost/api/search?q=test', null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns empty results for empty query without calling TIDAL', async () => {
		const res = await GET(event('http://localhost/api/search?q='));
		const data = await res.json();
		expect(data).toEqual({
			results: { tracks: [], albums: [], artists: [], playlists: [] }
		});
		expect(mocks.search).not.toHaveBeenCalled();
	});

	it('returns normalised search results when query is valid and connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.search.mockResolvedValue({
			data: [
				{
					id: 'trk-1',
					type: 'tracks',
					attributes: { title: 'Dynamic Track' },
					relationships: { artists: { data: [{ id: 'art-1', type: 'artists' }] } }
				}
			],
			included: [{ id: 'art-1', type: 'artists', attributes: { name: 'Dynamic Artist' } }]
		});

		const res = await GET(event('http://localhost/api/search?q=Dynamic'));
		const data = await res.json();
		expect(data.results.tracks).toHaveLength(1);
		expect(data.results.tracks[0].title).toBe('Dynamic Track');
		expect(data.results.tracks[0].artists[0].name).toBe('Dynamic Artist');
		expect(mocks.search).toHaveBeenCalledWith(
			'Dynamic',
			{
				types: ['tracks', 'albums', 'artists', 'playlists'],
				include: ['tracks.artists', 'tracks.albums', 'albums.artists']
			},
			expect.objectContaining({ fetch: fetchMock })
		);
	});

	it('accepts search query parameter ?search= as alternative to ?q=', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.search.mockResolvedValue({
			data: [],
			included: []
		});

		const res = await GET(event('http://localhost/api/search?search=Aphex+Twin'));
		const data = await res.json();
		expect(data.results).toEqual({
			tracks: [],
			albums: [],
			artists: [],
			playlists: []
		});
		expect(mocks.search).toHaveBeenCalledWith('Aphex Twin', expect.any(Object), expect.any(Object));
	});
});
