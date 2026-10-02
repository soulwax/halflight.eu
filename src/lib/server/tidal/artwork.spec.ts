import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getPlaybackTokenDetails: vi.fn() }));

vi.mock('./client', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return { ...actual, getPlaybackTokenDetails: mocks.getPlaybackTokenDetails };
});

import { getTrackCoverId, getAlbumCoverId, resetArtworkCache, tidalArtworkUrl } from './artwork';
import { TidalApiError } from './errors';

const COVER_ID = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';

describe('TIDAL artwork metadata', () => {
	beforeEach(() => {
		mocks.getPlaybackTokenDetails.mockReset();
		resetArtworkCache();
	});
	it('shares album cover lookups without colliding with a track using the same identifier', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ cover: COVER_ID })))
			.mockResolvedValueOnce(new Response(JSON.stringify({ album: { cover: null } })));
		const options = { accessToken: 'test-token', ctx: { fetch: fetchMock } };
		expect(
			await Promise.all([getAlbumCoverId('123', options), getAlbumCoverId('123', options)])
		).toEqual([COVER_ID, COVER_ID]);
		expect(await getTrackCoverId('123', options)).toBeNull();
		expect(await getAlbumCoverId('123', options)).toBe(COVER_ID);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[0]).toContain('/v1/albums/123?');
	});
	it('resolves the playback token and stored market with one authentication lookup', async () => {
		mocks.getPlaybackTokenDetails.mockResolvedValue({
			accessToken: 'test-token',
			countryCode: 'NL'
		});
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ album: { cover: COVER_ID } })));
		await expect(getTrackCoverId('321', { ctx: { fetch: fetchMock } })).resolves.toBe(COVER_ID);
		expect(mocks.getPlaybackTokenDetails).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/tracks/321?countryCode=NL',
			expect.anything()
		);
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
			'https://api.tidal.com/v1/tracks/12345?countryCode=DE',
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
	it('shares one metadata lookup across simultaneous artwork sizes', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ album: { cover: COVER_ID } })));
		const options = { accessToken: 'test-playback-token', ctx: { fetch: fetchMock } };
		const covers = await Promise.all([
			getTrackCoverId('123', options),
			getTrackCoverId('123', options)
		]);
		expect(covers).toEqual([COVER_ID, COVER_ID]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});
	it('releases a failed lookup so a later image request can retry', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 502 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ album: { cover: COVER_ID } })));
		const options = { accessToken: 'test-playback-token', ctx: { fetch: fetchMock } };
		await expect(getTrackCoverId('123', options)).rejects.toBeInstanceOf(TidalApiError);
		await expect(getTrackCoverId('123', options)).resolves.toBe(COVER_ID);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('uses the stored market supplied by the caller', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ album: { cover: COVER_ID } }), { status: 200 })
			);

		await getTrackCoverId('12345', {
			accessToken: 'test-playback-token',
			countryCode: 'NL',
			ctx: { fetch: fetchMock }
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/tracks/12345?countryCode=NL',
			expect.anything()
		);
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
