import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getUserPlaylists: vi.fn(),
		createUserPlaylist: vi.fn(),
		attemptTidalPlaylistSync: vi.fn(),
		updateUserPlaylist: vi.fn(),
		deleteUserPlaylist: vi.fn()
	};
});

const playback = vi.hoisted(() => ({ filter: vi.fn() }));
vi.mock('#lib/server/tidal/track-playability', () => ({ filterPlayableTracks: playback.filter }));

vi.mock('#lib/server/playlists', () => ({
	getUserPlaylists: mocks.getUserPlaylists,
	createUserPlaylist: mocks.createUserPlaylist,
	attemptTidalPlaylistSync: mocks.attemptTidalPlaylistSync,
	updateUserPlaylist: mocks.updateUserPlaylist,
	deleteUserPlaylist: mocks.deleteUserPlaylist
}));

import type { Cookies } from '@sveltejs/kit';
import { GET, POST } from './+server';
import { PATCH, DELETE } from './[id]/+server';

const fetchMock = vi.fn();

function makeEvent(
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	params: Record<string, string> = {},
	body?: Record<string, unknown>,
	user: { id: string } | null = { id: 'u1' },
	isListener = true
) {
	return {
		locals: { user, isListener },
		params,
		request: {
			json: vi.fn().mockResolvedValue(body ?? {})
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('API /api/playlists', () => {
	beforeEach(() => {
		playback.filter.mockReset().mockImplementation(async (tracks) => tracks);
		mocks.getUserPlaylists.mockReset().mockResolvedValue([]);
		mocks.createUserPlaylist.mockReset();
		mocks.attemptTidalPlaylistSync.mockReset();
		mocks.updateUserPlaylist.mockReset();
		mocks.deleteUserPlaylist.mockReset();
		fetchMock.mockReset();
	});

	describe('GET /api/playlists', () => {
		it('excludes confirmed defects from JSON without rewriting the stored playlist', async () => {
			const items = [{ id: 'good' }, { id: 'bad' }, { id: 'good' }];
			mocks.getUserPlaylists.mockResolvedValue([{ id: 'p', items }]);
			playback.filter.mockImplementation(async (tracks) =>
				tracks.filter((track: { id: string }) => track.id !== 'bad')
			);
			const response = await GET(makeEvent('GET'));
			expect((await response.json()).playlists[0].items).toEqual([{ id: 'good' }, { id: 'good' }]);
			expect(items).toHaveLength(3);
			expect(mocks.updateUserPlaylist).not.toHaveBeenCalled();
		});
		it('rejects unauthenticated requests with 401', async () => {
			await expect(GET(makeEvent('GET', {}, undefined, null))).rejects.toMatchObject({
				status: 401
			});
		});

		it('rejects a signed-in non-owner request with 401', async () => {
			await expect(
				GET(makeEvent('GET', {}, undefined, { id: 'other-user' }, false))
			).rejects.toMatchObject({
				status: 401
			});
		});

		it('returns user playlists from database', async () => {
			mocks.getUserPlaylists.mockResolvedValue([
				{
					id: 'pl_1',
					userId: 'u1',
					title: 'My Bauhaus Mix',
					description: 'Test',
					items: [],
					createdAt: '2026-09-02T00:00:00Z',
					updatedAt: '2026-09-02T00:00:00Z'
				}
			]);

			const res = await GET(makeEvent('GET'));
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.playlists).toHaveLength(1);
			expect(data.playlists[0].title).toBe('My Bauhaus Mix');
			expect(mocks.getUserPlaylists).toHaveBeenCalledWith('u1');
		});
	});

	describe('POST /api/playlists', () => {
		it('saves locally without publishing to TIDAL by default', async () => {
			mocks.createUserPlaylist.mockResolvedValue({ id: 'saved', title: 'Mix' });
			const response = await POST(
				makeEvent('POST', {}, { title: 'Mix', items: [{ id: 'track' }] })
			);
			expect(response.status).toBe(201);
			expect(mocks.attemptTidalPlaylistSync).not.toHaveBeenCalled();
		});
		it('returns an already saved owner playlist after a lost response without creating a duplicate', async () => {
			const playlist = { id: 'request-id', title: 'Mix', items: [] };
			mocks.getUserPlaylists.mockResolvedValue([playlist]);
			const response = await POST(
				makeEvent('POST', {}, { id: 'request-id', title: 'Mix', syncTidal: false })
			);
			expect(await response.json()).toEqual({ playlist });
			expect(mocks.getUserPlaylists).toHaveBeenCalledWith('u1');
			expect(mocks.createUserPlaylist).not.toHaveBeenCalled();
			expect(mocks.attemptTidalPlaylistSync).not.toHaveBeenCalled();
		});
		it('rejects unauthenticated requests with 401', async () => {
			await expect(POST(makeEvent('POST', {}, {}, null))).rejects.toMatchObject({
				status: 401
			});
		});

		it('creates and saves a playlist to user account in database', async () => {
			mocks.attemptTidalPlaylistSync.mockResolvedValue('tidal-pl-99');
			mocks.createUserPlaylist.mockResolvedValue({
				id: 'pl_custom_1',
				userId: 'u1',
				title: 'New Playlist',
				description: 'Desc',
				items: [],
				tidalPlaylistId: 'tidal-pl-99',
				createdAt: '2026-09-02T00:00:00Z',
				updatedAt: '2026-09-02T00:00:00Z'
			});

			const res = await POST(
				makeEvent(
					'POST',
					{},
					{
						title: 'New Playlist',
						description: 'Desc',
						items: [{ id: 't1', title: 'Song 1' }],
						syncTidal: true
					}
				)
			);

			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.playlist.id).toBe('pl_custom_1');
			expect(data.playlist.tidalPlaylistId).toBe('tidal-pl-99');
			expect(mocks.createUserPlaylist).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'u1',
					title: 'New Playlist',
					tidalPlaylistId: 'tidal-pl-99'
				})
			);
		});
	});

	describe('PATCH & DELETE /api/playlists/[id]', () => {
		it('updates playlist items', async () => {
			mocks.updateUserPlaylist.mockResolvedValue({
				id: 'pl_1',
				userId: 'u1',
				title: 'Updated Title',
				items: [{ id: 't1' }]
			});

			const res = await PATCH(
				makeEvent(
					'PATCH',
					{ id: 'pl_1' },
					{
						title: 'Updated Title',
						items: [{ id: 't1' }]
					}
				) as unknown as Parameters<typeof PATCH>[0]
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.playlist.title).toBe('Updated Title');
			expect(mocks.updateUserPlaylist).toHaveBeenCalledWith(
				'u1',
				'pl_1',
				expect.objectContaining({ title: 'Updated Title' })
			);
		});

		it('deletes playlist', async () => {
			mocks.deleteUserPlaylist.mockResolvedValue(true);

			const res = await DELETE(
				makeEvent('DELETE', { id: 'pl_1' }) as unknown as Parameters<typeof DELETE>[0]
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.success).toBe(true);
			expect(mocks.deleteUserPlaylist).toHaveBeenCalledWith('u1', 'pl_1');
		});

		it('returns 404 when the playlist is already absent', async () => {
			mocks.deleteUserPlaylist.mockResolvedValue(false);

			const res = await DELETE(
				makeEvent('DELETE', { id: 'pl_missing' }) as unknown as Parameters<typeof DELETE>[0]
			);
			expect(res.status).toBe(404);
		});
	});
});
