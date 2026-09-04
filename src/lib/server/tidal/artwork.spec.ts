import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getPlaybackToken: vi.fn() }));

vi.mock('./client', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return { ...actual, getPlaybackToken: mocks.getPlaybackToken };
});

import { getTrackCoverId, resetArtworkCache, tidalArtworkUrl } from './artwork';
import { TidalApiError } from './errors';

const COVER_ID = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';

describe('TIDAL artwork metadata', () => {
	beforeEach(() => {
		mocks.getPlaybackToken.mockReset();
		resetArtworkCache();
	});

	it('resolves and caches a legacy album cover identifier', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ album: { cover: COVER_ID } }), { status: 200 })
			);

		const first = await getTrackCoverId('12345', {
			accessToken: 'test-playback-token',
			ctx: { fetch: fetchMock as typeof fetch },
			now: 1_000
		});
		const second = await getTrackCoverId('12345', {
			accessToken: 'test-playback-token',
			ctx: { fetch: fetchMock as typeof fetch },
			now: 1_001
		});

		expect(first).toBe(COVER_ID);
		expect(second).toBe(COVER_ID);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/tracks/12345',
			expect.objectContaining({
				headers: { authorization: 'Bearer test-playback-token', accept: 'application/json' }
			})
		);
	});

	it('returns null for tracks without a valid cover instead of constructing an arbitrary URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ album: { cover: 'https://untrusted.example/image.jpg' } }), {
				status: 200
			})
		);

		await expect(
			getTrackCoverId('12345', { accessToken: 'test-playback-token', ctx: { fetch: fetchMock } })
		).resolves.toBeNull();
		expect(tidalArtworkUrl(COVER_ID)).toBe(
			'https://resources.tidal.com/images/a0b1c2d3/e4f5/6789/abcd/ef0123456789/640x640.jpg'
		);
		expect(() => tidalArtworkUrl('not-a-cover')).toThrow('Invalid TIDAL artwork identifier.');
	});

	it('preserves upstream failure status for the route to translate safely', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{}', { status: 403, statusText: 'Forbidden' }));

		await expect(
			getTrackCoverId('12345', { accessToken: 'test-playback-token', ctx: { fetch: fetchMock } })
		).rejects.toBeInstanceOf(TidalApiError);
	});
});
