import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class MockTidalApiError extends Error {
		constructor(readonly status: number) {
			super(`TIDAL API ${status}`);
		}
	}

	class MockTidalAuthError extends Error {}
	class MockTidalNotConnectedError extends Error {}

	return {
		getConnectionStatus: vi.fn(),
		getAlbum: vi.fn(),
		getAlbumRelationship: vi.fn().mockResolvedValue(null),
		fetchAlbumReview: vi.fn().mockResolvedValue(null),
		MockTidalApiError,
		MockTidalAuthError,
		MockTidalNotConnectedError
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	fetchAlbumReview: mocks.fetchAlbumReview,
	tidalApi: {
		getAlbum: mocks.getAlbum,
		getAlbumRelationship: mocks.getAlbumRelationship
	},
	TidalApiError: mocks.MockTidalApiError,
	TidalAuthError: mocks.MockTidalAuthError,
	TidalNotConnectedError: mocks.MockTidalNotConnectedError
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'album-1') {
	return {
		locals: { user: { id: 'user-1' } },
		params: { id },
		fetch: fetchMock
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/albums/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getAlbum.mockReset();
		mocks.fetchAlbumReview.mockReset();
		mocks.fetchAlbumReview.mockResolvedValue(null);
		fetchMock.mockReset();
	});

	it('returns a normalised album and includes its artists and items', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getAlbum.mockResolvedValue({
			data: {
				id: 'album-1',
				type: 'albums',
				attributes: { title: 'Album One', releaseDate: '2022-05-10', audioQuality: 'LOSSLESS' },
				relationships: {
					artists: { data: [{ id: 'artist-1', type: 'artists' }] },
					items: { data: [{ id: 'track-1', type: 'tracks' }] }
				}
			},
			included: [
				{ id: 'artist-1', type: 'artists', attributes: { name: 'Artist One' } },
				{
					id: 'track-1',
					type: 'tracks',
					attributes: { title: 'Track One', trackNumber: 1, duration: 200 }
				}
			]
		});

		await expect(load(event())).resolves.toEqual({
			id: 'album-1',
			configured: true,
			state: null,
			review: null,
			album: {
				kind: 'album',
				id: 'album-1',
				title: 'Album One',
				artists: [{ id: 'artist-1', name: 'Artist One' }],
				releaseDate: '2022-05-10',
				audioQuality: 'LOSSLESS',
				items: [
					{
						kind: 'track',
						id: 'track-1',
						title: 'Track One',
						trackNumber: 1,
						duration: 200,
						artists: [],
						album: {
							id: 'album-1',
							title: 'Album One',
							releaseDate: '2022-05-10'
						}
					}
				],
				duration: 200,
				numberOfItems: 1
			}
		});
		expect(mocks.getAlbum).toHaveBeenCalledWith(
			'album-1',
			{ include: ['artists', 'items'] },
			{ fetch: fetchMock }
		);
	});

	it('returns a safe connection state without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			album: null,
			state: 'not_connected',
			configured: true,
			id: 'album-1'
		});
		expect(mocks.getAlbum).not.toHaveBeenCalled();
	});

	it('maps a 404 upstream to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getAlbum.mockRejectedValue(new mocks.MockTidalApiError(404));

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', album: null });
	});

	it('maps an expired authorization to a reconnect state', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getAlbum.mockRejectedValue(new mocks.MockTidalAuthError());

		await expect(load(event())).resolves.toMatchObject({
			state: 'authorization_expired',
			album: null
		});
	});

	it('rejects an overlong id before reading connection', async () => {
		await expect(load(event('x'.repeat(161)))).resolves.toEqual({
			album: null,
			state: 'invalid_id',
			configured: true,
			id: undefined
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
		expect(mocks.getAlbum).not.toHaveBeenCalled();
	});
});
