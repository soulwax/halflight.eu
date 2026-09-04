import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		listImportablePlaylists: vi.fn(),
		pullPlaylist: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus
}));

vi.mock('#lib/server/playlists/sync', () => ({
	listImportablePlaylists: mocks.listImportablePlaylists,
	pullPlaylist: mocks.pullPlaylist
}));

import type { Cookies } from '@sveltejs/kit';
import { GET, POST } from './+server';

const fetchMock = vi.fn();

function makeEvent(body: Record<string, unknown> = {}, user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		request: {
			json: vi.fn().mockResolvedValue(body)
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('API /api/playlists/import', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.listImportablePlaylists.mockReset();
		mocks.pullPlaylist.mockReset();
		fetchMock.mockReset();
	});

	describe('GET /api/playlists/import', () => {
		it('rejects unauthenticated requests with 401', async () => {
			await expect(GET(makeEvent({}, null))).rejects.toMatchObject({
				status: 401
			});
		});

		it('returns 503 if TIDAL is not connected', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: false });
			const res = await GET(makeEvent());
			expect(res.status).toBe(503);
			const json = await res.json();
			expect(json.error).toBe('not_connected');
		});

		it('returns list of importable playlists when connected', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			mocks.listImportablePlaylists.mockResolvedValue({
				playlists: [{ id: 'pl-1', title: 'Roadtrip', isImported: false }],
				error: null
			});

			const res = await GET(makeEvent());
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.playlists).toHaveLength(1);
			expect(json.playlists[0].title).toBe('Roadtrip');
		});
	});

	describe('POST /api/playlists/import', () => {
		it('rejects unauthenticated requests with 401', async () => {
			await expect(POST(makeEvent({}, null))).rejects.toMatchObject({
				status: 401
			});
		});

		it('rejects empty or missing tidalPlaylistIds with 400', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			await expect(POST(makeEvent({ tidalPlaylistIds: [] }))).rejects.toMatchObject({
				status: 400
			});
		});

		it('imports specified playlists', async () => {
			mocks.getConnectionStatus.mockResolvedValue({ connected: true });
			mocks.pullPlaylist.mockResolvedValue({
				playlistId: 'p1',
				tidalPlaylistId: 'pl-1',
				status: 'created',
				tracksAdded: 5,
				tracksRemoved: 0
			});

			const res = await POST(makeEvent({ tidalPlaylistIds: ['pl-1'] }));
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.totalImported).toBe(1);
			expect(json.totalErrors).toBe(0);
			expect(mocks.pullPlaylist).toHaveBeenCalledWith('pl-1', expect.anything());
		});
	});
});
