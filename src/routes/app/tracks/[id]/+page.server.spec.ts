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
		getTrack: vi.fn(),
		getTrackRelationship: vi.fn().mockResolvedValue(null),
		getArtistRelationship: vi.fn().mockResolvedValue(null),
		fetchTrackLyrics: vi.fn().mockResolvedValue(null),
		MockTidalApiError,
		MockTidalAuthError,
		MockTidalNotConnectedError
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	fetchTrackLyrics: mocks.fetchTrackLyrics,
	tidalApi: {
		getTrack: mocks.getTrack,
		getTrackRelationship: mocks.getTrackRelationship,
		getArtistRelationship: mocks.getArtistRelationship
	},
	TidalApiError: mocks.MockTidalApiError,
	TidalAuthError: mocks.MockTidalAuthError,
	TidalNotConnectedError: mocks.MockTidalNotConnectedError
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'track-1') {
	return {
		locals: { user: { id: 'user-1' } },
		params: { id },
		fetch: fetchMock
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/tracks/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrack.mockReset();
		mocks.fetchTrackLyrics.mockReset();
		mocks.fetchTrackLyrics.mockResolvedValue(null);
		fetchMock.mockReset();
	});

	it('returns a normalised track and includes its artists and albums', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getTrack.mockResolvedValue({
			data: {
				id: 'track-1',
				type: 'tracks',
				attributes: { title: 'Track One', ignored: 'raw upstream data' },
				relationships: {
					artists: { data: [{ id: 'artist-1', type: 'artists' }] },
					albums: { data: [{ id: 'album-1', type: 'albums' }] }
				}
			},
			included: [
				{ id: 'artist-1', type: 'artists', attributes: { name: 'Artist One' } },
				{ id: 'album-1', type: 'albums', attributes: { title: 'Album One' } }
			]
		});

		await expect(load(event())).resolves.toEqual({
			id: 'track-1',
			configured: true,
			state: null,
			lyrics: null,
			track: {
				kind: 'track',
				id: 'track-1',
				title: 'Track One',
				artists: [{ id: 'artist-1', name: 'Artist One' }],
				album: { id: 'album-1', title: 'Album One' }
			}
		});
		expect(mocks.getTrack).toHaveBeenCalledWith(
			'track-1',
			{ include: ['albums', 'artists'] },
			{ fetch: fetchMock }
		);
	});

	it('returns a safe connection state without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			track: null,
			state: 'not_connected',
			configured: true,
			id: 'track-1'
		});
		expect(mocks.getTrack).not.toHaveBeenCalled();
	});

	it('maps a missing or malformed upstream track to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getTrack.mockRejectedValue(new mocks.MockTidalApiError(404));

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', track: null });

		mocks.getTrack.mockResolvedValue({ data: { id: 'album-1', type: 'albums' } });
		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', track: null });
	});

	it('maps an expired authorization to a reconnect state', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getTrack.mockRejectedValue(new mocks.MockTidalAuthError());

		await expect(load(event())).resolves.toMatchObject({
			state: 'authorization_expired',
			track: null
		});
	});

	it('rejects an overlong id before reading the connection or upstream API', async () => {
		await expect(load(event('x'.repeat(161)))).resolves.toEqual({
			track: null,
			state: 'invalid_id',
			configured: true,
			id: undefined
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
		expect(mocks.getTrack).not.toHaveBeenCalled();
	});
});
