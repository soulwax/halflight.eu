import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		getUserPlaylists: vi.fn(),
		pullPlaylist: vi.fn(),
		pushPlaylist: vi.fn(),
		pullAllPlaylists: vi.fn(),
		pushAllPlaylists: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus
}));

vi.mock('#lib/server/playlists', () => ({
	getUserPlaylists: mocks.getUserPlaylists
}));

vi.mock('#lib/server/playlists/sync', () => ({
	pullPlaylist: mocks.pullPlaylist,
	pushPlaylist: mocks.pushPlaylist,
	pullAllPlaylists: mocks.pullAllPlaylists,
	pushAllPlaylists: mocks.pushAllPlaylists
}));

import type { Cookies } from '@sveltejs/kit';
import { POST } from './+server';

const fetchMock = vi.fn();

function makeEvent(
	body: Record<string, unknown> = {},
	user: { id: string } | null = { id: 'u1' },
	isListener = true
) {
	return {
		locals: { user, isListener },
		request: {
			json: vi.fn().mockResolvedValue(body)
		},
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/playlists/sync', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getUserPlaylists.mockReset();
		mocks.pullPlaylist.mockReset();
		mocks.pushPlaylist.mockReset();
		mocks.pullAllPlaylists.mockReset();
		mocks.pushAllPlaylists.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(POST(makeEvent({}, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects a signed-in non-owner request with 401', async () => {
		await expect(POST(makeEvent({}, { id: 'other-user' }, false))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns 503 if TIDAL is not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await POST(makeEvent({ action: 'pull_all' }));
		expect(res.status).toBe(503);
		const json = await res.json();
		expect(json.error).toBe('not_connected');
	});

	it('returns 403 if write scopes are missing', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, hasWriteScopes: false });
		const res = await POST(makeEvent({ action: 'pull_all' }));
		expect(res.status).toBe(403);
		const json = await res.json();
		expect(json.error).toBe('missing_write_scopes');
	});

	it('pulls a single playlist when action=pull and tidalPlaylistId is provided', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, hasWriteScopes: true });
		mocks.pullPlaylist.mockResolvedValue({
			playlistId: 'p1',
			tidalPlaylistId: 't-123',
			status: 'synced',
			tracksAdded: 2,
			tracksRemoved: 0
		});

		const res = await POST(makeEvent({ action: 'pull', tidalPlaylistId: 't-123' }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.status).toBe('synced');
		expect(mocks.pullPlaylist).toHaveBeenCalledWith(
			't-123',
			expect.objectContaining({ userId: 'u1' })
		);
	});

	it('pushes a single playlist when action=push and playlistId is found', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, hasWriteScopes: true });
		mocks.getUserPlaylists.mockResolvedValue([{ id: 'p1', title: 'Test List', items: [] }]);
		mocks.pushPlaylist.mockResolvedValue({
			playlistId: 'p1',
			tidalPlaylistId: 't-123',
			status: 'synced',
			tracksAdded: 0,
			tracksRemoved: 0
		});

		const res = await POST(makeEvent({ action: 'push', playlistId: 'p1' }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.status).toBe('synced');
		expect(mocks.pushPlaylist).toHaveBeenCalled();
	});

	it('handles pull_all action', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, hasWriteScopes: true });
		mocks.pullAllPlaylists.mockResolvedValue({
			results: [],
			totalSynced: 3,
			totalErrors: 0
		});

		const res = await POST(makeEvent({ action: 'pull_all' }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.totalSynced).toBe(3);
	});

	it('handles push_all action', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, hasWriteScopes: true });
		mocks.pushAllPlaylists.mockResolvedValue({
			results: [],
			totalSynced: 2,
			totalErrors: 0
		});

		const res = await POST(makeEvent({ action: 'push_all' }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.totalSynced).toBe(2);
	});
});
