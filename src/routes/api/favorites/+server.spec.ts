import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		readRecord: vi.fn(),
		fetchUserFavorites: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	readRecord: mocks.readRecord,
	fetchUserFavorites: mocks.fetchUserFavorites
}));

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function makeEvent(user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		request: { json: vi.fn() },
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/favorites', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.readRecord.mockReset();
		mocks.fetchUserFavorites.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(GET(makeEvent(null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns 503 if TIDAL is not connected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await GET(makeEvent());
		expect(res.status).toBe(503);
		const data = await res.json();
		expect(data.connected).toBe(false);
	});

	it('returns favorites when connected with valid record', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true, tidalUserId: 'usr-99' });
		mocks.readRecord.mockResolvedValue({ userId: 'usr-99' });

		mocks.fetchUserFavorites.mockResolvedValue({
			tracks: ['1', '2'],
			albums: ['3'],
			artists: ['4'],
			playlists: [],
			videos: [],
			totalCount: 4
		});

		const res = await GET(makeEvent());
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.connected).toBe(true);
		expect(data.favorites.totalCount).toBe(4);
		expect(data.favorites.tracks).toEqual(['1', '2']);
	});
});
