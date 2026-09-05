import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTrack: vi.fn(),
	fetchAlbumCredits: vi.fn()
}));
vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	fetchAlbumCredits: mocks.fetchAlbumCredits,
	tidalApi: { getTrack: mocks.getTrack }
}));

import { GET } from './+server';

const event = (isAdministrator = true) =>
	({
		locals: { user: { id: 'owner' }, isAdministrator },
		params: { id: 'track-1' },
		fetch: vi.fn(),
		cookies: {}
	}) as any;

describe('GET /api/tracks/[id]/credits', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrack.mockReset();
		mocks.fetchAlbumCredits.mockReset();
	});
	it('returns only the current track credits from its verified album', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrack.mockResolvedValue({
			data: {
				id: 'track-1',
				type: 'tracks',
				attributes: { title: 'Track' },
				relationships: { albums: { data: [{ id: 'album-1', type: 'albums' }] } }
			},
			included: [{ id: 'album-1', type: 'albums', attributes: { title: 'Album' } }]
		});
		mocks.fetchAlbumCredits.mockResolvedValue([
			{
				item: { id: 'track-1' },
				credits: [{ type: 'Producer', contributors: [{ name: 'Producer One' }] }]
			},
			{ item: { id: 'other' }, credits: [{ type: 'Writer', contributors: [{ name: 'Other' }] }] }
		]);

		const response = await GET(event());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			credits: [{ type: 'Producer', contributors: [{ name: 'Producer One' }] }]
		});
		expect(mocks.fetchAlbumCredits).toHaveBeenCalledWith('album-1', expect.any(Object));
	});

	it('rejects a signed-in non-owner before provider calls', async () => {
		await expect(GET(event(false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});
});
