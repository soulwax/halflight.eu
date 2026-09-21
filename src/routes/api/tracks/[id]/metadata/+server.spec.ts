import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TidalApiError } from '#lib/server/tidal/errors';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTrack: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { getTrack: mocks.getTrack }
}));

import { GET } from './+server';

const event = (user: { id: string } | null = { id: 'owner' }, isAdministrator = true) =>
	({
		locals: { user, isAdministrator },
		params: { id: 'track-1' },
		fetch: vi.fn(),
		cookies: {}
	}) as any;

describe('GET /api/tracks/[id]/metadata', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrack.mockReset();
	});

	it('returns a normalised track with a same-origin artwork path', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrack.mockResolvedValue({
			data: {
				id: 'track-1',
				type: 'tracks',
				attributes: { title: 'Bela Lugosi Is Dead', duration: 542 },
				relationships: {
					artists: { data: [{ id: 'artist-1', type: 'artists' }] },
					albums: { data: [{ id: 'album-1', type: 'albums' }] }
				}
			},
			included: [
				{ id: 'artist-1', type: 'artists', attributes: { name: 'Bauhaus' } },
				{
					id: 'album-1',
					type: 'albums',
					attributes: {
						title: 'Press the Eject',
						releaseDate: '1982-01-01',
						imageUrl: 'https://resources.tidal.com/images/private-cover/640x640.jpg'
					}
				}
			]
		});

		const response = await GET(event());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			track: {
				kind: 'track',
				id: 'track-1',
				title: 'Bela Lugosi Is Dead',
				duration: 542,
				artists: [{ id: 'artist-1', name: 'Bauhaus' }],
				imageUrl: '/api/tracks/track-1/artwork',
				album: {
					id: 'album-1',
					title: 'Press the Eject',
					releaseDate: '1982-01-01',
					imageUrl: '/api/tracks/track-1/artwork'
				}
			}
		});
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(mocks.getTrack).toHaveBeenCalledWith(
			'track-1',
			{ include: ['artists', 'albums'] },
			expect.any(Object)
		);
	});

	it('does not read provider data for an unauthorised request', async () => {
		await expect(GET(event(null))).rejects.toMatchObject({ status: 401 });
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('returns a safe connection failure before requesting metadata', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		const response = await GET(event());

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'not_connected' });
		expect(mocks.getTrack).not.toHaveBeenCalled();
	});

	it('marks an upstream missing recording as not found instead of a retryable outage', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrack.mockRejectedValue(new TidalApiError(404, 'Not Found', null, '/tracks/track-1'));

		const response = await GET(event());

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'not_found' });
	});

	it('keeps genuine provider failures safely retryable', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrack.mockRejectedValue(
			new TidalApiError(503, 'Unavailable', null, '/tracks/track-1')
		);

		const response = await GET(event());

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: 'metadata_unavailable' });
	});
});
