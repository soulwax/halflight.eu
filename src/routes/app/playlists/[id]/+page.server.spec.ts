import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError, TidalAuthError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getPlaylist: vi.fn(),
	getPlaylistItems: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: {
		getPlaylist: mocks.getPlaylist,
		getPlaylistItems: mocks.getPlaylistItems
	}
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'playlist-1') {
	return {
		locals: { user: { id: 'user-1' } },
		params: { id },
		fetch: fetchMock
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/playlists/[id] load', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getPlaylist.mockReset();
		mocks.getPlaylistItems.mockReset();
		fetchMock.mockReset();
	});

	it('returns a normalised playlist and items', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getPlaylist.mockResolvedValue({
			data: {
				id: 'playlist-1',
				type: 'playlists',
				attributes: { title: 'My Playlist', description: 'Fun tunes' },
				relationships: {
					items: { data: [{ id: 'track-1', type: 'tracks' }] },
					creator: { data: { id: 'user-1', type: 'users' } }
				}
			},
			included: [
				{ id: 'user-1', type: 'users', attributes: { name: 'Soulwax' } },
				{ id: 'track-1', type: 'tracks', attributes: { title: 'Track One', duration: 150 } }
			]
		});

		await expect(load(event())).resolves.toEqual({
			id: 'playlist-1',
			configured: true,
			state: null,
			playlist: {
				kind: 'playlist',
				id: 'playlist-1',
				title: 'My Playlist',
				description: 'Fun tunes',
				creator: { id: 'user-1', name: 'Soulwax' },
				items: [
					{
						kind: 'track',
						id: 'track-1',
						title: 'Track One',
						duration: 150,
						artists: []
					}
				],
				duration: 150,
				numberOfItems: 1
			}
		});
		expect(mocks.getPlaylist).toHaveBeenCalledWith(
			'playlist-1',
			{ include: ['items'] },
			{ fetch: fetchMock }
		);
	});

	it('returns a safe connection state without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			playlist: null,
			state: 'not_connected',
			configured: true,
			id: 'playlist-1'
		});
		expect(mocks.getPlaylist).not.toHaveBeenCalled();
	});

	it('maps a 404 upstream to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getPlaylist.mockRejectedValue(
			new TidalApiError(404, 'Not Found', null, '/playlists/playlist-1')
		);

		await expect(load(event())).resolves.toMatchObject({ state: 'not_found', playlist: null });
	});

	it('maps an expired authorization to reconnect', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getPlaylist.mockRejectedValue(new TidalAuthError());

		await expect(load(event())).resolves.toMatchObject({
			state: 'authorization_expired',
			playlist: null
		});
	});

	it('rejects an overlong id before reading connection', async () => {
		await expect(load(event('x'.repeat(161)))).resolves.toEqual({
			playlist: null,
			state: 'invalid_id',
			configured: true,
			id: undefined
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});
});
