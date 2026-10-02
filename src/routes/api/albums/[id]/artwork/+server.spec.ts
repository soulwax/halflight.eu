import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getAlbumCoverId: vi.fn(), tidalArtworkUrl: vi.fn() }));
vi.mock('#lib/server/tidal', () => mocks);
import { GET } from './+server';

const event = (owner = true) =>
	({
		locals: { user: { id: 'owner' }, isAdministrator: owner },
		params: { id: '456' },
		url: new URL('https://halflight.test/api/albums/456/artwork?size=80'),
		fetch: vi.fn(),
		cookies: {}
	}) as any;

beforeEach(() => vi.clearAllMocks());

describe('album artwork route', () => {
	it('requires the owner before consulting the artwork cache', async () => {
		await expect(GET(event(false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.getAlbumCoverId).not.toHaveBeenCalled();
	});
	it('resolves an album image through the shared proxy without exposing its provider address', async () => {
		mocks.getAlbumCoverId.mockResolvedValue('valid-cover');
		mocks.tidalArtworkUrl.mockReturnValue('https://resources.tidal.com/images/cover/80x80.jpg');
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('image', { headers: { 'content-type': 'image/jpeg' } }));
		try {
			const response = await GET(event());
			expect(mocks.getAlbumCoverId).toHaveBeenCalledWith('456', expect.anything());
			expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
			expect(response.headers.get('location')).toBeNull();
			expect(await response.text()).toBe('image');
		} finally {
			fetchMock.mockRestore();
		}
	});
});
