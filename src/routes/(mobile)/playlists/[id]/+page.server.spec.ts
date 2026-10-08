import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getUserPlaylists: vi.fn(),
	getConnectionStatus: vi.fn(),
	getFullPlaylist: vi.fn()
}));

vi.mock('#lib/server/playlists', () => ({ getUserPlaylists: mocks.getUserPlaylists }));
vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getFullPlaylist: mocks.getFullPlaylist },
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));

import { load } from './+page.server';

const fetchMock = vi.fn();

function event(id = 'pl-1', isListener = true) {
	return {
		locals: { user: { id: 'owner' }, isListener },
		params: { id },
		fetch: fetchMock,
		cookies: {}
	} as unknown as Parameters<typeof load>[0];
}

const track = { kind: 'track', id: 't1', title: 'Track One', artists: [] };

describe('/(mobile)/playlists/[id] load', () => {
	beforeEach(() => {
		mocks.getUserPlaylists.mockReset().mockResolvedValue([]);
		mocks.getConnectionStatus.mockReset();
		mocks.getFullPlaylist.mockReset();
		fetchMock.mockReset();
	});

	it('forbids a non-owner', async () => {
		await expect(load(event('pl-1', false))).rejects.toMatchObject({ status: 403 });
		expect(mocks.getUserPlaylists).not.toHaveBeenCalled();
	});

	it('resolves a saved local playlist without touching TIDAL', async () => {
		mocks.getUserPlaylists.mockResolvedValue([
			{
				id: 'pl-1',
				title: 'My Set',
				description: 'late night',
				items: [track],
				tidalPlaylistId: null
			}
		]);

		const result = await load(event('pl-1'));
		expect(result).toEqual({
			playlist: {
				kind: 'playlist',
				id: 'pl-1',
				title: 'My Set',
				description: 'late night',
				numberOfItems: 1,
				items: [track]
			},
			isLocal: true,
			editVersion: expect.stringMatching(/^[0-9a-f]{64}$/),
			editTracks: [track],
			state: null,
			id: 'pl-1'
		});
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
		expect(mocks.getFullPlaylist).not.toHaveBeenCalled();
	});

	it('normalises a TIDAL playlist when it is not a saved one', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getFullPlaylist.mockResolvedValue({
			data: {
				id: 'pl-9',
				type: 'playlists',
				attributes: { name: 'Editorial Mix', numberOfItems: 1 },
				relationships: { items: { data: [{ id: 't9', type: 'tracks' }] } }
			},
			included: [{ id: 't9', type: 'tracks', attributes: { title: 'Nine' } }]
		});

		const result = await load(event('pl-9'));
		expect(result).toMatchObject({
			isLocal: false,
			state: null,
			playlist: { id: 'pl-9', items: [{ id: 't9', title: 'Nine' }] }
		});
	});

	it('returns not_connected without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false, configured: true });

		await expect(load(event('pl-9'))).resolves.toEqual({
			playlist: null,
			isLocal: false,
			state: 'not_connected',
			id: 'pl-9'
		});
		expect(mocks.getFullPlaylist).not.toHaveBeenCalled();
	});

	it('maps a 404 to not_found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, configured: true });
		mocks.getFullPlaylist.mockRejectedValue(
			new TidalApiError(404, 'Not Found', null, '/playlists/pl-9')
		);

		await expect(load(event('pl-9'))).resolves.toMatchObject({
			state: 'not_found',
			playlist: null
		});
	});
});
