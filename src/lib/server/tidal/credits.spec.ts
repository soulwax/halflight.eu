import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAlbumCredits } from './credits';
import { TidalApiError } from './errors';

const mocks = vi.hoisted(() => {
	return {
		getPlaybackToken: vi.fn()
	};
});

vi.mock('./client', () => ({
	getPlaybackToken: mocks.getPlaybackToken
}));

describe('credits module (translated from tiddl)', () => {
	beforeEach(() => {
		mocks.getPlaybackToken.mockReset();
	});

	it('fetches album credits from TIDAL API', async () => {
		mocks.getPlaybackToken.mockResolvedValue('test-access-token');

		const mockData = {
			limit: 20,
			offset: 0,
			totalNumberOfItems: 1,
			items: [
				{
					item: { id: 101, title: 'Bela Lugosi' },
					credits: [
						{
							type: 'Producer',
							contributors: [{ id: 1, name: 'Bauhaus' }]
						},
						{
							type: 'Composer',
							contributors: [{ id: 2, name: 'Peter Murphy' }]
						}
					]
				}
			]
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockData
		});

		const result = await fetchAlbumCredits('alb-100', {
			ctx: { fetch: fetchMock },
			countryCode: 'US',
			limit: 10
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/albums/alb-100/items/credits?countryCode=US&limit=10',
			{
				headers: {
					authorization: 'Bearer test-access-token',
					accept: 'application/json'
				}
			}
		);

		expect(result).toHaveLength(1);
		expect(result[0].item.title).toBe('Bela Lugosi');
		expect(result[0].credits).toHaveLength(2);
		expect(result[0].credits[0].type).toBe('Producer');
	});

	it('returns empty array when album is 404', async () => {
		mocks.getPlaybackToken.mockResolvedValue('test-access-token');

		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404
		});

		const result = await fetchAlbumCredits('alb-404', {
			ctx: { fetch: fetchMock }
		});

		expect(result).toEqual([]);
	});

	it('throws TidalApiError when request fails with 500', async () => {
		mocks.getPlaybackToken.mockResolvedValue('test-access-token');

		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ message: 'Server error' })
		});

		await expect(fetchAlbumCredits('alb-500', { ctx: { fetch: fetchMock } })).rejects.toThrow(
			TidalApiError
		);
	});
});
