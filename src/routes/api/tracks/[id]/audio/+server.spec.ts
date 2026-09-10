import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	resolveTrackStreamCached: vi.fn(),
	getStreamingSettings: vi.fn(),
	getRequestedStreamQuality: vi.fn()
}));

vi.mock('#lib/server/streaming-settings', () => ({
	getStreamingSettings: mocks.getStreamingSettings,
	isStreamingQuality: (value: string) =>
		['LOW', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'].includes(value)
}));
vi.mock('#lib/server/tidal', async (importOriginal) => ({
	...((await importOriginal()) as object),
	resolveTrackStreamCached: mocks.resolveTrackStreamCached,
	getRequestedStreamQuality: mocks.getRequestedStreamQuality
}));

import type { Cookies } from '@sveltejs/kit';
import { __resetSegmentCache, TidalApiError } from '#lib/server/tidal';
import { GET, HEAD } from './+server';

// The route fetches CDN media with the *global* fetch (not `event.fetch`), because
// SvelteKit's wrapper forwards request context that the media CDN 403s on.
const fetchMock = vi.fn();

function event(range?: string, isAdministrator = true, extraHeaders: Record<string, string> = {}) {
	return {
		locals: { user: { id: 'owner-1' }, isAdministrator },
		params: { id: '123' },
		url: new URL('https://syn.test/api/tracks/123/audio'),
		request: new Request('https://syn.test/api/tracks/123/audio', {
			headers: { ...(range ? { range } : {}), ...extraHeaders }
		}),
		fetch: fetchMock,
		cookies: {} as Cookies
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/tracks/[id]/audio', () => {
	afterEach(() => vi.unstubAllGlobals());

	beforeEach(() => {
		mocks.resolveTrackStreamCached.mockReset();
		mocks.getStreamingSettings.mockReset();
		mocks.getRequestedStreamQuality.mockReset();
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
		mocks.getStreamingSettings.mockResolvedValue({ preferredQuality: 'HIGH' });
		mocks.getRequestedStreamQuality.mockResolvedValue('HIGH');
		mocks.resolveTrackStreamCached.mockResolvedValue({
			streamUrl: 'https://cdn.example.test/audio',
			mimeType: 'audio/mp4'
		});
		fetchMock.mockResolvedValue(
			new Response(new Uint8Array([1, 2]), {
				status: 206,
				headers: {
					'content-length': '2',
					'content-range': 'bytes 0-1/2',
					'content-type': 'audio/mp4; codecs=mp4a.40.2'
				}
			})
		);
	});

	it('proxies media and forwards the byte range', async () => {
		const response = await GET(event('bytes=0-1'));
		expect(response.status).toBe(206);
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(response.headers.get('Content-Type')).toBe('audio/mp4; codecs=mp4a.40.2');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://cdn.example.test/audio',
			expect.objectContaining({ headers: expect.any(Headers) })
		);
		expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Range')).toBe('bytes=0-1');
	});

	it('lets the browser cache audio so a replayed region costs no CDN round-trip', async () => {
		mocks.resolveTrackStreamCached.mockResolvedValue({
			trackId: 123,
			audioQuality: 'LOSSLESS',
			streamUrl: 'https://cdn.example.test/audio',
			mimeType: 'audio/flac'
		});

		const response = await GET(event('bytes=0-1'));
		expect(response.headers.get('Cache-Control')).toBe('private, max-age=600');
		// Quality belongs in the tag: the URL does not carry it, so without it a
		// preference change would be served the old tier from cache.
		expect(response.headers.get('ETag')).toBe('"123-LOSSLESS"');
	});

	it('answers a matching If-None-Match with 304 and never reaches the CDN', async () => {
		mocks.resolveTrackStreamCached.mockResolvedValue({
			trackId: 123,
			audioQuality: 'LOSSLESS',
			streamUrl: 'https://cdn.example.test/audio',
			mimeType: 'audio/flac'
		});

		const response = await GET(event(undefined, true, { 'if-none-match': '"123-LOSSLESS"' }));

		expect(response.status).toBe(304);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('ignores a range whose If-Range names a different representation', async () => {
		mocks.resolveTrackStreamCached.mockResolvedValue({
			trackId: 123,
			audioQuality: 'LOSSLESS',
			streamUrl: 'https://cdn.example.test/audio',
			mimeType: 'audio/flac'
		});

		// The client holds a partial from a different tier; it must be given the
		// whole representation rather than a range spliced across the two.
		await GET(event('bytes=0-1', true, { 'if-range': '"123-HIGH"' }));

		expect(new Headers(fetchMock.mock.calls[0][1].headers).has('Range')).toBe(false);
	});

	it('answers a HEAD probe with headers and no body', async () => {
		const response = await HEAD(event());
		expect(response.status).toBe(206);
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(response.body).toBeNull();
	});

	it('does not resolve media for a signed-in non-owner', async () => {
		await expect(GET(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.resolveTrackStreamCached).not.toHaveBeenCalled();
	});

	it('does not disguise a removed catalogue asset as a playback-Link failure', async () => {
		mocks.resolveTrackStreamCached.mockRejectedValueOnce(
			new TidalApiError(401, 'Asset is not ready for playback', null, '/v1/tracks/123/playbackinfo')
		);

		await expect(GET(event())).rejects.toMatchObject({ status: 404 });
	});

	describe('segmented (HiRes DASH) delivery', () => {
		const SEGMENTS = [
			'https://cdn.example.test/init.mp4',
			'https://cdn.example.test/seg-1.mp4',
			'https://cdn.example.test/seg-2.mp4'
		];

		beforeEach(() => {
			__resetSegmentCache();
			mocks.getRequestedStreamQuality.mockResolvedValue('HI_RES_LOSSLESS');
			mocks.resolveTrackStreamCached.mockResolvedValue({
				trackId: 123,
				audioQuality: 'HI_RES_LOSSLESS',
				segmented: true,
				urls: SEGMENTS,
				streamUrl: SEGMENTS[0],
				mimeType: 'audio/mp4'
			});
			// Each fragment is 4 bytes; full stream is 12 bytes.
			fetchMock.mockImplementation((url: string) => {
				const idx = SEGMENTS.indexOf(url);
				return Promise.resolve(new Response(new Uint8Array([idx, idx, idx, idx])));
			});
		});

		it('concatenates every fragment for a full (rangeless) request', async () => {
			const response = await GET(event());
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Length')).toBe('12');
			expect(response.headers.get('Accept-Ranges')).toBe('bytes');
			expect(new Uint8Array(await response.arrayBuffer())).toEqual(
				new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2])
			);
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});

		it('serves a byte range from cache without re-fetching segments', async () => {
			await GET(event()); // prime the cache (3 fetches)
			fetchMock.mockClear();

			const response = await GET(event('bytes=5-9'));
			expect(response.status).toBe(206);
			expect(response.headers.get('Content-Range')).toBe('bytes 5-9/12');
			expect(response.headers.get('Content-Length')).toBe('5');
			expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 1, 1, 2, 2]));
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
