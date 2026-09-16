import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTrackRelationship: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getTrackRelationship: mocks.getTrackRelationship },
	filterPlayableTracks: vi.fn(async (tracks: unknown[]) => tracks)
}));

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function event(
	trackId = 'track-1',
	user: { id: string } | null = { id: 'u1' },
	isAdministrator = true
) {
	return {
		locals: { user, isAdministrator },
		params: { id: trackId },
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

const radioDocument = {
	data: [
		{
			id: 'track-1',
			type: 'tracks',
			attributes: { title: 'Seed track' },
			relationships: { artists: { data: [{ id: 'artist-1', type: 'artists' }] } }
		},
		{
			id: 'track-2',
			type: 'tracks',
			attributes: { title: 'Radio track' },
			relationships: { artists: { data: [{ id: 'artist-1', type: 'artists' }] } }
		}
	],
	included: [{ id: 'artist-1', type: 'artists', attributes: { name: 'Artist' } }]
};

describe('GET /api/tracks/[id]/radio', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrackRelationship.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests', async () => {
		await expect(GET(event('track-1', null))).rejects.toMatchObject({ status: 401 });
	});

	it('does not call TIDAL while disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		const response = await GET(event());

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ tracks: [], error: 'not_connected' });
		expect(mocks.getTrackRelationship).not.toHaveBeenCalled();
	});

	it('returns normalized radio tracks without the seed track', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrackRelationship.mockResolvedValue(radioDocument);

		const response = await GET(event());
		const body = await response.json();

		expect(response.headers.get('cache-control')).toContain('no-store');
		expect(body.tracks).toEqual([
			expect.objectContaining({
				id: 'track-2',
				title: 'Radio track',
				artists: [{ id: 'artist-1', name: 'Artist' }]
			})
		]);
		expect(mocks.getTrackRelationship).toHaveBeenCalledWith(
			'track-1',
			'radio',
			{ include: ['albums', 'artists'] },
			expect.objectContaining({ fetch: fetchMock })
		);
	});

	it('falls back to similar tracks when the radio relationship is unavailable', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrackRelationship.mockRejectedValueOnce(new Error('missing radio'));
		mocks.getTrackRelationship.mockResolvedValueOnce(radioDocument);

		const response = await GET(event());

		expect(response.status).toBe(200);
		expect(mocks.getTrackRelationship).toHaveBeenNthCalledWith(
			2,
			'track-1',
			'similarTracks',
			{ include: ['albums', 'artists'] },
			expect.any(Object)
		);
	});
});
