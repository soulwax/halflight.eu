import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getTrackCoverId: vi.fn()
}));

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		getConnectionStatus: mocks.getConnectionStatus,
		getTrackCoverId: mocks.getTrackCoverId
	};
});

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

const fetchMock = vi.fn();

function makeEvent(
	trackId = '12345',
	user: { id: string } | null = { id: 'u1' },
	isListener = true
) {
	return {
		locals: { user, isListener },
		params: { id: trackId },
		fetch: fetchMock,
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/cover', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getTrackCoverId.mockReset();
		fetchMock.mockReset();
	});

	it('rejects unauthenticated requests with 401', async () => {
		await expect(GET(makeEvent('12345', null))).rejects.toMatchObject({ status: 401 });
	});

	it('returns a null cover without calling TIDAL when disconnected', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });
		const res = await GET(makeEvent());

		expect(await res.json()).toEqual({ imageUrl: null, album: null });
		expect(mocks.getTrackCoverId).not.toHaveBeenCalled();
	});

	it('returns a same-origin artwork route from the legacy cover resolver', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrackCoverId.mockResolvedValue('a0b1c2d3-e4f5-6789-abcd-ef0123456789');

		const res = await GET(makeEvent());
		const body = await res.json();

		expect(body).toEqual({ imageUrl: '/api/tracks/12345/artwork', album: null });
		expect(body.imageUrl).not.toContain('resources.tidal.com');
		expect(res.headers.get('cache-control')).toContain('max-age=3600');
		expect(mocks.getTrackCoverId).toHaveBeenCalledWith(
			'12345',
			expect.objectContaining({ ctx: expect.objectContaining({ fetch: fetchMock }) })
		);
	});

	it('degrades to a null cover when the legacy metadata lookup fails', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTrackCoverId.mockRejectedValue(new Error('boom'));

		const res = await GET(makeEvent());

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ imageUrl: null, album: null });
	});
});
