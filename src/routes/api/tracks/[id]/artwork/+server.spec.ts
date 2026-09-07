import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getTrackCoverId: vi.fn(), tidalArtworkUrl: vi.fn() }));

vi.mock('#lib/server/tidal', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return { ...actual, ...mocks };
});

import type { Cookies } from '@sveltejs/kit';
import { GET } from './+server';

function makeEvent(user: { id: string } | null = { id: 'owner-1' }, isAdministrator = true) {
	return {
		locals: { user, isAdministrator },
		params: { id: '12345' },
		fetch: vi.fn(),
		cookies: {} as unknown as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/artwork', () => {
	beforeEach(() => {
		mocks.getTrackCoverId.mockReset();
		mocks.tidalArtworkUrl.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('rejects unauthenticated requests', async () => {
		await expect(GET(makeEvent(null))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects signed-in non-owners', async () => {
		await expect(GET(makeEvent({ id: 'someone-else' }, false))).rejects.toMatchObject({
			status: 401
		});
	});

	it('proxies a valid image without exposing the CDN to the resolver response', async () => {
		mocks.getTrackCoverId.mockResolvedValue('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
		mocks.tidalArtworkUrl.mockReturnValue('https://resources.tidal.com/images/cover/640x640.jpg');
		const globalFetch = vi.mocked(fetch).mockResolvedValue(
			new Response('image-bytes', {
				status: 200,
				headers: { 'content-type': 'image/jpeg', 'content-length': '11' }
			})
		);

		const response = await GET(makeEvent());

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/jpeg');
		expect(response.headers.get('cache-control')).toContain('private');
		expect(await response.text()).toBe('image-bytes');
		expect(globalFetch).toHaveBeenCalledWith(
			'https://resources.tidal.com/images/cover/640x640.jpg',
			expect.objectContaining({ redirect: 'follow' })
		);
	});

	it('does not proxy a non-image CDN response', async () => {
		mocks.getTrackCoverId.mockResolvedValue('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
		mocks.tidalArtworkUrl.mockReturnValue('https://resources.tidal.com/images/cover/640x640.jpg');
		vi.mocked(fetch).mockResolvedValue(
			new Response('not an image', { status: 200, headers: { 'content-type': 'text/html' } })
		);

		await expect(GET(makeEvent())).rejects.toMatchObject({ status: 502 });
	});
});
