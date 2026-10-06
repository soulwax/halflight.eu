import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getArtist: vi.fn(),
	getArtistRelationship: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: {
		getArtist: mocks.getArtist,
		getArtistRelationship: mocks.getArtistRelationship
	},
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'artist-1', isListener = true) {
	return {
		locals: { user: { id: 'owner' }, isListener },
		params: { id },
		fetch: fetchMock,
		cookies: {}
	} as unknown as Parameters<typeof load>[0];
}

describe('/(mobile)/artists/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getArtist.mockReset();
		mocks.getArtistRelationship.mockReset();
		fetchMock.mockReset();
	});

	it('forbids a non-owner', async () => {
		await expect(load(event('artist-1', false))).rejects.toMatchObject({ status: 403 });
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('returns a normalised artist with top tracks and albums', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getArtist.mockResolvedValue({
			data: { id: 'artist-1', type: 'artists', attributes: { name: 'Bauhaus' } }
		});
		mocks.getArtistRelationship.mockImplementation((_id: string, rel: string) => {
			if (rel === 'tracks') {
				return Promise.resolve({
					data: [{ id: 't1', type: 'tracks', attributes: { title: 'Dark Entries' } }],
					included: []
				});
			}
			if (rel === 'albums') {
				return Promise.resolve({
					data: [{ id: 'al1', type: 'albums', attributes: { title: 'In the Flat Field' } }],
					included: []
				});
			}
			return Promise.resolve(null);
		});

		const result = await load(event());
		expect(result).toMatchObject({
			id: 'artist-1',
			state: null,
			artist: {
				id: 'artist-1',
				name: 'Bauhaus',
				topTracks: [{ id: 't1', title: 'Dark Entries' }],
				albums: [{ id: 'al1', title: 'In the Flat Field' }]
			}
		});
		expect(mocks.getArtistRelationship).toHaveBeenCalledWith(
			'artist-1',
			'tracks',
			expect.objectContaining({ collapseBy: 'FINGERPRINT' }),
			expect.any(Object)
		);
	});

	it('returns not_connected without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			artist: null,
			state: 'not_connected',
			id: 'artist-1'
		});
		expect(mocks.getArtist).not.toHaveBeenCalled();
	});

	it('maps a 404 to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getArtist.mockRejectedValue(
			new TidalApiError(404, 'Not Found', null, '/artists/artist-1')
		);

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', artist: null });
	});
});
