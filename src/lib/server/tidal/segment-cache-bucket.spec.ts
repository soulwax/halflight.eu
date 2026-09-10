import { describe, expect, it, vi } from 'vitest';
import { createTidalSegmentCache } from './segment-cache-bucket';

const cacheKey = '123:HI_RES_LOSSLESS';

function configuredCache(client?: { send(command: unknown): Promise<unknown> }) {
	return createTidalSegmentCache(
		{
			enabled: true,
			bucket: 'tidal-cache',
			endpoint: 'https://bucket.example.test',
			accessKeyId: 'key',
			secretAccessKey: 'secret'
		},
		client
	);
}

describe('tidal segment cache bucket', () => {
	it('remains disabled until a complete isolated cache configuration is supplied', () => {
		expect(createTidalSegmentCache({ enabled: true, bucket: 'tidal-cache' }).enabled).toBe(false);
		expect(
			createTidalSegmentCache({
				bucket: 'tidal-cache',
				endpoint: 'https://bucket.example.test',
				accessKeyId: 'key',
				secretAccessKey: 'secret'
			}).enabled
		).toBe(false);
	});

	it('stores a bounded assembly with a short retention marker and opaque object key', async () => {
		const send = vi.fn().mockResolvedValue({});
		const cache = configuredCache({ send });
		await cache.put({
			cacheKey,
			bytes: new Uint8Array([1, 2, 3]),
			contentType: 'audio/mp4'
		});

		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({
					Bucket: 'tidal-cache',
					Key: expect.stringMatching(/^syn-tidal-cache\/v1\/[a-f0-9]{64}\.mp4$/),
					Metadata: expect.objectContaining({
						'expires-at': expect.any(String),
						'size-bytes': '3'
					}),
					Expires: expect.any(Date)
				})
			})
		);
	});

	it('returns a bounded stream for a valid cached range', async () => {
		const send = vi.fn().mockResolvedValue({
			Body: { transformToWebStream: () => new ReadableStream<Uint8Array>() },
			ContentLength: 6,
			ContentRange: 'bytes 4-9/12',
			ContentType: 'audio/mp4',
			Metadata: { 'expires-at': String(Date.now() + 60_000), 'size-bytes': '12' }
		});
		const cache = configuredCache({ send });
		const cached = await cache.get(cacheKey, 'bytes=4-9');

		expect(cached?.contentRange).toBe('bytes 4-9/12');
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({ Bucket: 'tidal-cache', Range: 'bytes=4-9' })
			})
		);
	});

	it('answers a cache metadata probe without opening an audio body', async () => {
		const send = vi.fn().mockResolvedValue({
			ContentLength: 12,
			ContentType: 'audio/mp4',
			Metadata: { 'expires-at': String(Date.now() + 60_000), 'size-bytes': '12' }
		});
		const cache = configuredCache({ send });

		expect(await cache.head(cacheKey)).toEqual({ contentLength: 12, contentType: 'audio/mp4' });
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({ Bucket: 'tidal-cache', Key: expect.any(String) })
			}),
			// The probe is awaited on the playback path, so it carries its own
			// deadline rather than inheriting the SDK's unbounded default.
			expect.objectContaining({ abortSignal: expect.any(AbortSignal) })
		);
	});

	it('does not put a deadline on the streaming body read', async () => {
		// `get` streams a whole track; an operation-wide signal would abort it
		// mid-download, so only `head` carries one.
		const send = vi.fn().mockResolvedValue({
			Body: { transformToWebStream: () => new ReadableStream<Uint8Array>() },
			ContentLength: 12,
			ContentType: 'audio/mp4',
			Metadata: { 'expires-at': String(Date.now() + 60_000), 'size-bytes': '12' }
		});
		const cache = configuredCache({ send });

		expect(await cache.get(cacheKey)).not.toBeNull();
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][1]).toBeUndefined();
	});

	it('treats expired or unavailable objects as cache misses', async () => {
		const send = vi.fn().mockResolvedValue({
			Body: { transformToWebStream: () => new ReadableStream<Uint8Array>() },
			Metadata: { 'expires-at': String(Date.now() - 1) }
		});
		const cache = configuredCache({ send });

		expect(await cache.get(cacheKey)).toBeNull();
		expect(send).toHaveBeenCalledTimes(2);
	});

	it('drops malformed cached-object metadata and closes its response body', async () => {
		let cancelled = false;
		const send = vi.fn().mockResolvedValue({
			Body: {
				transformToWebStream: () =>
					new ReadableStream<Uint8Array>({
						cancel() {
							cancelled = true;
						}
					})
			},
			ContentLength: 13,
			Metadata: { 'expires-at': String(Date.now() + 60_000), 'size-bytes': '12' }
		});
		const cache = configuredCache({ send });

		expect(await cache.get(cacheKey)).toBeNull();
		expect(cancelled).toBe(true);
	});
});
