import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError, TidalAuthError } from '#lib/server/tidal/errors';

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
	}
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'artist-1') {
	return {
		locals: { user: { id: 'user-1' } },
		params: { id },
		fetch: fetchMock
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/artists/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getArtist.mockReset();
		mocks.getArtistRelationship.mockReset();
		fetchMock.mockReset();
	});

	it('returns a normalised artist with top tracks, albums, and similar artists', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getArtist.mockResolvedValue({
			data: {
				id: 'artist-1',
				type: 'artists',
				attributes: { name: 'Main Artist', popularity: 88 }
			}
		});
		mocks.getArtistRelationship.mockImplementation((id, rel) => {
			if (rel === 'tracks') {
				return Promise.resolve({
					data: [{ id: 'track-1', type: 'tracks', attributes: { title: 'Track One' } }]
				});
			}
			if (rel === 'albums') {
				return Promise.resolve({
					data: [{ id: 'album-1', type: 'albums', attributes: { title: 'Album One' } }]
				});
			}
			if (rel === 'similarArtists') {
				return Promise.resolve({
					data: [{ id: 'artist-2', type: 'artists', attributes: { name: 'Artist Two' } }]
				});
			}
			return Promise.resolve({ data: [] });
		});

		await expect(load(event())).resolves.toEqual({
			id: 'artist-1',
			configured: true,
			state: null,
			artist: {
				kind: 'artist',
				id: 'artist-1',
				name: 'Main Artist',
				popularity: 88,
				topTracks: [
					{
						kind: 'track',
						id: 'track-1',
						title: 'Track One',
						artists: []
					}
				],
				albums: [
					{
						kind: 'album',
						id: 'album-1',
						title: 'Album One',
						artists: []
					}
				],
				similarArtists: [
					{
						kind: 'artist',
						id: 'artist-2',
						name: 'Artist Two'
					}
				]
			}
		});
		expect(mocks.getArtist).toHaveBeenCalledWith('artist-1', {}, { fetch: fetchMock });
	});

	it('returns a safe connection state without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			artist: null,
			state: 'not_connected',
			configured: true,
			id: 'artist-1'
		});
		expect(mocks.getArtist).not.toHaveBeenCalled();
	});

	it('maps a 404 upstream to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getArtist.mockRejectedValue(
			new TidalApiError(404, 'Not Found', null, '/artists/artist-1')
		);

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', artist: null });
	});

	it('maps an expired authorization to reconnect', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getArtist.mockRejectedValue(new TidalAuthError());

		await expect(load(event())).resolves.toMatchObject({
			state: 'authorization_expired',
			artist: null
		});
	});

	it('rejects an overlong id before reading connection', async () => {
		await expect(load(event('x'.repeat(161)))).resolves.toEqual({
			artist: null,
			state: 'invalid_id',
			configured: true,
			id: undefined
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});
});
