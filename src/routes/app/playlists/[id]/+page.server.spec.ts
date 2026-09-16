import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError, TidalAuthError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getPlaylist: vi.fn(),
	getPlaylistItems: vi.fn(),
	getUserPlaylists: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: {
		getPlaylist: mocks.getPlaylist,
		getPlaylistItems: mocks.getPlaylistItems
	},
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));

vi.mock('#lib/server/playlists', () => ({
	getUserPlaylists: mocks.getUserPlaylists
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
		mocks.getUserPlaylists.mockReset();
		mocks.getUserPlaylists.mockResolvedValue([]);
		fetchMock.mockReset();
	});

	it('returns a normalised playlist and items from TIDAL', async () => {
		mocks.getConnectionStatus.mockResolvedValue({
			connected: true,
			configured: true,
			hasWriteScopes: true
		});
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
			localPlaylist: null,
			isLocal: false,
			syncStatus: null,
			hasWriteScopes: true,
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

	it('fetches remaining items when initial playlist response has fewer items than numberOfItems', async () => {
		mocks.getConnectionStatus.mockResolvedValue({
			connected: true,
			configured: true,
			hasWriteScopes: true
		});
		mocks.getPlaylist.mockResolvedValue({
			data: {
				id: 'playlist-big',
				type: 'playlists',
				attributes: { title: 'Large Playlist', numberOfItems: 25 },
				relationships: {
					items: {
						data: Array.from({ length: 20 }, (_, i) => ({ id: `t-${i}`, type: 'tracks' }))
					}
				}
			},
			included: Array.from({ length: 20 }, (_, i) => ({
				id: `t-${i}`,
				type: 'tracks',
				attributes: { title: `Track ${i}` }
			}))
		});
		mocks.getPlaylistItems.mockResolvedValue({
			data: Array.from({ length: 25 }, (_, i) => ({ id: `t-${i}`, type: 'tracks' })),
			included: Array.from({ length: 25 }, (_, i) => ({
				id: `t-${i}`,
				type: 'tracks',
				attributes: { title: `Track ${i}` }
			}))
		});

		const res = await load(event('playlist-big'));
		if (!res) throw new Error('Expected load result');
		expect(res.playlist?.items.length).toBe(25);
		expect(mocks.getPlaylistItems).toHaveBeenCalledWith('playlist-big', {}, { fetch: fetchMock });
	});

	it('returns a local custom playlist without calling TIDAL if id matches local playlist', async () => {
		mocks.getConnectionStatus.mockResolvedValue({
			connected: true,
			configured: true,
			hasWriteScopes: true
		});
		mocks.getUserPlaylists.mockResolvedValue([
			{
				id: 'pl_local_1',
				userId: 'user-1',
				title: 'My Custom List',
				description: 'Hand-picked',
				items: [{ kind: 'track', id: 'trk-1', title: 'Local Song', artists: [] }],
				tidalPlaylistId: 't-123',
				source: 'syn',
				syncStatus: 'synced',
				createdAt: '2026-09-04T00:00:00Z',
				updatedAt: '2026-09-04T00:00:00Z'
			}
		]);

		const res = await load(event('pl_local_1'));
		if (!res) throw new Error('Expected load result');
		expect(res.isLocal).toBe(true);
		expect(res.playlist?.title).toBe('My Custom List');
		expect(res.syncStatus).toBe('synced');
		expect(mocks.getPlaylist).not.toHaveBeenCalled();
	});

	it('returns a safe connection state without calling TIDAL when disconnected and not local', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event())).resolves.toEqual({
			playlist: null,
			localPlaylist: null,
			isLocal: false,
			syncStatus: null,
			hasWriteScopes: false,
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
			localPlaylist: null,
			isLocal: false,
			syncStatus: null,
			hasWriteScopes: false,
			state: 'invalid_id',
			configured: true,
			id: undefined
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});
});
