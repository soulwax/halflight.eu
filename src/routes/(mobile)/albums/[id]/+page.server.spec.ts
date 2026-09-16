import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getAlbum: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getAlbum: mocks.getAlbum },
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'album-1', isAdministrator = true) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator },
		params: { id },
		fetch: fetchMock,
		cookies: {}
	} as unknown as Parameters<typeof load>[0];
}

describe('/(mobile)/albums/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getAlbum.mockReset();
		fetchMock.mockReset();
	});

	it('forbids a non-owner', async () => {
		await expect(load(event('album-1', false))).rejects.toMatchObject({ status: 403 });
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('returns the normalised album with its items', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getAlbum.mockResolvedValue({
			data: {
				id: 'album-1',
				type: 'albums',
				attributes: { title: 'Album One', releaseDate: '2022-05-10' },
				relationships: {
					artists: { data: [{ id: 'artist-1', type: 'artists' }] },
					items: { data: [{ id: 'track-1', type: 'tracks' }] }
				}
			},
			included: [
				{ id: 'artist-1', type: 'artists', attributes: { name: 'Artist One' } },
				{ id: 'track-1', type: 'tracks', attributes: { title: 'Track One', trackNumber: 1 } }
			]
		});

		const result = await load(event());
		expect(result).toMatchObject({
			id: 'album-1',
			state: null,
			album: { id: 'album-1', title: 'Album One', items: [{ id: 'track-1', title: 'Track One' }] }
		});
	});

	it('returns not_connected without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			album: null,
			state: 'not_connected',
			id: 'album-1'
		});
		expect(mocks.getAlbum).not.toHaveBeenCalled();
	});

	it('maps a 404 to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getAlbum.mockRejectedValue(new TidalApiError(404, 'Not Found', null, '/albums/album-1'));

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', album: null });
	});
});
