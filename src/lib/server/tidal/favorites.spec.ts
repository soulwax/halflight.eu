import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUserFavorites } from './favorites';
import { TidalApiError } from './errors';

const mocks = vi.hoisted(() => {
	return {
		getPlaybackToken: vi.fn()
	};
});

vi.mock('./client', () => ({
	getPlaybackToken: mocks.getPlaybackToken
}));

describe('favorites module (translated from tiddl)', () => {
	beforeEach(() => {
		mocks.getPlaybackToken.mockReset();
	});

	it('fetches and normalizes favorites IDs', async () => {
		mocks.getPlaybackToken.mockResolvedValue('test-access-token');

		const mockData = {
			TRACK: [123, 456],
			ALBUM: [789],
			ARTIST: [1011],
			PLAYLIST: ['uuid-pl-1'],
			VIDEO: []
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockData
		});

		const result = await fetchUserFavorites('usr-42', {
			ctx: { fetch: fetchMock },
			countryCode: 'US'
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/users/usr-42/favorites/ids?countryCode=US',
			{
				headers: {
					authorization: 'Bearer test-access-token',
					accept: 'application/json'
				}
			}
		);

		expect(result).toEqual({
			tracks: ['123', '456'],
			albums: ['789'],
			artists: ['1011'],
			playlists: ['uuid-pl-1'],
			videos: [],
			totalCount: 5
		});
	});

	it('throws TidalApiError when API fails', async () => {
		mocks.getPlaybackToken.mockResolvedValue('test-access-token');

		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: 'internal' })
		});

		await expect(fetchUserFavorites('usr-42', { ctx: { fetch: fetchMock } })).rejects.toThrow(
			TidalApiError
		);
	});
});
