import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTrack: vi.fn()
}));

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		getConnectionStatus: mocks.getConnectionStatus,
		tidalApi: { getTrack: mocks.getTrack }
	};
});

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function makeEvent(trackId = 'trk-1', user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		params: { id: trackId },
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

// A track whose album is side-loaded with cover art.
const trackDoc = {
	data: {
		id: 'trk-1',
		type: 'tracks',
		attributes: { title: 'Autobahn', duration: 1360 },
		relationships: { albums: { data: [{ id: 'al-1', type: 'albums' }] } }
	},
	included: [
		{
			id: 'al-1',
			type: 'albums',
			attributes: {
				title: 'Autobahn',
				releaseDate: '1974-11-01',
				imageUrl: 'https://resources.tidal.com/images/aaa/640x640.jpg'
			}
		}
	]
};

describe('GET /api/tracks/[id]/cover', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrack.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(GET(makeEvent('trk-1', null))).rejects.toMatchObject({ status: 401 });
	});

	it('returns a null cover without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await GET(makeEvent('trk-1'));
		expect(await res.json()).toEqual({ imageUrl: null, album: null });
		expect(mocks.getTrack).not.toHaveBeenCalled();
	});

	it('resolves artwork and the album reference from a side-loaded album', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrack.mockResolvedValue(trackDoc);

		const res = await GET(makeEvent('trk-1'));
		const body = await res.json();

		expect(body.imageUrl).toBe('https://resources.tidal.com/images/aaa/640x640.jpg');
		expect(body.album).toMatchObject({ id: 'al-1', title: 'Autobahn', releaseDate: '1974-11-01' });
		expect(res.headers.get('cache-control')).toContain('max-age=3600');
		expect(mocks.getTrack).toHaveBeenCalledWith(
			'trk-1',
			{ include: ['albums', 'artists'] },
			expect.objectContaining({ fetch: fetchMock })
		);
	});

	it('degrades to a null cover when the upstream call fails', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrack.mockRejectedValue(new Error('boom'));

		const res = await GET(makeEvent('trk-1'));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ imageUrl: null, album: null });
	});
});
