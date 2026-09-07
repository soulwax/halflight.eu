import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	deletePlaylistRemote,
	getFullPlaylist,
	getOwnedPlaylists,
	removePlaylistItems,
	replacePlaylistItems,
	updatePlaylist
} from './api';
import { getAccessToken, tidalJson } from './client';
import { TIDAL_API_BASE } from './config';
import { TidalApiError } from './errors';

vi.mock('./client', () => ({
	tidalJson: vi.fn(),
	tidalFetch: vi.fn(),
	getAccessToken: vi.fn()
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('TIDAL playlist API wrappers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockReset();
	});

	it('updatePlaylist sends PATCH with correct JSON:API body', async () => {
		expect.assertions(1);
		vi.mocked(tidalJson).mockResolvedValue({ data: { id: 'p1' } } as any);

		await updatePlaylist('p1', { title: 'New Title', description: 'Desc' });

		expect(tidalJson).toHaveBeenCalledWith(
			'/playlists/p1',
			{
				method: 'PATCH',
				body: JSON.stringify({
					data: {
						type: 'playlists',
						id: 'p1',
						attributes: { title: 'New Title', description: 'Desc' }
					}
				})
			},
			undefined
		);
	});

	it('deletePlaylistRemote sends DELETE and handles 204 no-content', async () => {
		expect.assertions(2);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve('')
		});

		await deletePlaylistRemote('p1');

		expect(getAccessToken).toHaveBeenCalled();
		expect(mockFetch).toHaveBeenCalledWith(`${TIDAL_API_BASE}/playlists/p1`, {
			method: 'DELETE',
			headers: {
				authorization: 'Bearer token123',
				'content-type': 'application/vnd.api+json'
			}
		});
	});

	it('deletePlaylistRemote throws TidalApiError on non-ok responses', async () => {
		expect.assertions(1);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			text: () => Promise.resolve('err')
		});

		await expect(deletePlaylistRemote('p1')).rejects.toThrow(TidalApiError);
	});

	it('removePlaylistItems chunks >50 items into multiple DELETE calls', async () => {
		expect.assertions(3);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve('')
		});

		const items = Array.from({ length: 120 }, (_, i) => ({ id: `t${i}` }));
		await removePlaylistItems('p1', items);

		expect(mockFetch).toHaveBeenCalledTimes(3); // 50, 50, 20
		expect(mockFetch).toHaveBeenNthCalledWith(
			1,
			`${TIDAL_API_BASE}/playlists/p1/relationships/items`,
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(mockFetch).toHaveBeenNthCalledWith(
			3,
			`${TIDAL_API_BASE}/playlists/p1/relationships/items`,
			expect.objectContaining({ method: 'DELETE' })
		);
	});

	it('replacePlaylistItems sends PUT with correct JSON:API body', async () => {
		expect.assertions(2);
		vi.mocked(getAccessToken).mockResolvedValue('token123');
		mockFetch.mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve('')
		});

		await replacePlaylistItems('p1', [{ id: 't1' }, { id: 'v1', type: 'videos' }]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(`${TIDAL_API_BASE}/playlists/p1/relationships/items`, {
			method: 'PUT',
			headers: {
				authorization: 'Bearer token123',
				'content-type': 'application/vnd.api+json'
			},
			body: JSON.stringify({
				data: [
					{ id: 't1', type: 'tracks' },
					{ id: 'v1', type: 'videos' }
				]
			})
		});
	});

	it('getFullPlaylist returns document directly when all items are present', async () => {
		expect.assertions(2);
		vi.mocked(tidalJson).mockResolvedValueOnce({
			data: {
				id: 'p1',
				type: 'playlists',
				attributes: { numberOfItems: 2 },
				relationships: {
					items: {
						data: [
							{ id: 't1', type: 'tracks' },
							{ id: 't2', type: 'tracks' }
						]
					}
				}
			},
			included: [
				{ id: 't1', type: 'tracks' },
				{ id: 't2', type: 'tracks' }
			]
		} as any);

		const res = await getFullPlaylist('p1');
		expect(tidalJson).toHaveBeenCalledTimes(1);
		expect((res.data as any).relationships.items.data).toHaveLength(2);
	});

	it('getFullPlaylist fetches remaining items when numberOfItems exceeds initial items', async () => {
		expect.assertions(4);
		// First call: initial getPlaylist with 1 item but numberOfItems is 3
		vi.mocked(tidalJson).mockResolvedValueOnce({
			data: {
				id: 'p1',
				type: 'playlists',
				attributes: { numberOfItems: 3 },
				relationships: {
					items: {
						data: [{ id: 't1', type: 'tracks' }]
					}
				}
			},
			included: [{ id: 't1', type: 'tracks' }]
		} as any);

		// Second call: getPlaylistItems returning page with t1, t2, and an
		// offset-style next link. The importer must follow TIDAL's supplied URL
		// rather than assuming cursor pagination (which used to stop at 20 items).
		vi.mocked(tidalJson).mockResolvedValueOnce({
			data: [
				{ id: 't1', type: 'tracks' },
				{ id: 't2', type: 'tracks' }
			],
			included: [
				{ id: 't1', type: 'tracks' },
				{ id: 't2', type: 'tracks' }
			],
			links: {
				next: 'https://openapi.tidal.com/playlists/p1/relationships/items?page%5Boffset%5D=2'
			}
		} as any);

		// Third call: getPlaylistItems returning page with t3 (no next)
		vi.mocked(tidalJson).mockResolvedValueOnce({
			data: [{ id: 't3', type: 'tracks' }],
			included: [{ id: 't3', type: 'tracks' }]
		} as any);

		const res = await getFullPlaylist('p1');
		expect(tidalJson).toHaveBeenCalledTimes(3);
		expect(tidalJson).toHaveBeenNthCalledWith(
			3,
			'https://openapi.tidal.com/playlists/p1/relationships/items?page%5Boffset%5D=2',
			{},
			undefined
		);
		expect((res.data as any).relationships.items.data).toHaveLength(3);
		expect(res.included).toHaveLength(7); // initial t1 + page1/2 included (t1, t2, t3) + page1/2 items (t1, t2, t3)
	});

	it('uses nested item includes so TIDAL does not reject playlist imports with 400', async () => {
		expect.assertions(2);
		vi.mocked(tidalJson).mockResolvedValue({
			data: {
				id: 'p1',
				type: 'playlists',
				attributes: { numberOfItems: 1 },
				relationships: { items: { data: [{ id: 't1', type: 'tracks' }] } }
			}
		} as any);

		await getFullPlaylist('p1', { include: ['artists', 'albums'] });

		expect(tidalJson).toHaveBeenCalledWith(
			'/playlists/p1?include=items%2Citems.artists%2Citems.albums',
			{},
			undefined
		);
		expect(tidalJson).not.toHaveBeenCalledWith(
			'/playlists/p1?include=items%2Cartists%2Calbums',
			expect.anything(),
			expect.anything()
		);
	});

	it('rejects an incomplete playlist rather than importing a partial order', async () => {
		expect.assertions(1);
		vi.mocked(tidalJson)
			.mockResolvedValueOnce({
				data: {
					id: 'p1',
					type: 'playlists',
					attributes: { numberOfItems: 2 },
					relationships: { items: { data: [{ id: 't1', type: 'tracks' }] } }
				}
			} as any)
			.mockResolvedValueOnce({
				data: [{ id: 't1', type: 'tracks' }],
				included: [{ id: 't1', type: 'tracks' }]
			} as any);

		await expect(getFullPlaylist('p1')).rejects.toThrow('TIDAL playlist items were incomplete.');
	});

	it('lists every owner playlist across legacy pages', async () => {
		expect.assertions(3);
		vi.mocked(tidalJson)
			.mockResolvedValueOnce({
				items: [
					{ uuid: 'owner-1', title: 'First', numberOfTracks: 2 },
					{ uuid: 'owner-2', title: 'Second' }
				],
				total: 3
			} as any)
			.mockResolvedValueOnce({
				items: [{ uuid: 'owner-3', title: 'Third', description: 'A set' }],
				total: 3
			} as any);

		const playlists = await getOwnedPlaylists('tidal-user');

		expect(playlists).toEqual([
			{ kind: 'playlist', id: 'owner-1', title: 'First', numberOfItems: 2 },
			{ kind: 'playlist', id: 'owner-2', title: 'Second' },
			{ kind: 'playlist', id: 'owner-3', title: 'Third', description: 'A set' }
		]);
		expect(tidalJson).toHaveBeenCalledTimes(2);
		expect(tidalJson).toHaveBeenNthCalledWith(
			2,
			'https://api.tidal.com/v1/users/tidal-user/playlists?limit=100&offset=2',
			{},
			undefined
		);
	});
});
