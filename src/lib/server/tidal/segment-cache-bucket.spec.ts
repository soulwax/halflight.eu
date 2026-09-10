import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createTidalSegmentCache } from './segment-cache-bucket';
import type { CachedObjectRecord, SegmentCacheIndex } from './segment-cache-index';

const cacheKey = '123:HI_RES_LOSSLESS';

/**
 * Stands in for the Postgres record of what has been written. The bucket cannot
 * be listed, so this index is the only way the sweeper knows an object exists.
 */
function memoryIndex(seed: CachedObjectRecord[] = []): SegmentCacheIndex & {
	rows: Map<string, CachedObjectRecord>;
} {
	const rows = new Map(seed.map((entry) => [entry.objectKey, entry]));
	return {
		rows,
		record: (entry) => {
			rows.set(entry.objectKey, entry);
			return Promise.resolve();
		},
		claimExpired: (now, limit) =>
			Promise.resolve(
				[...rows.values()]
					.filter((entry) => entry.expiresAt < now)
					.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
					.slice(0, limit)
					.map((entry) => entry.objectKey)
			),
		forget: (keys) => {
			for (const key of keys) rows.delete(key);
			return Promise.resolve();
		}
	};
}

function configuredCache(
	client?: { send(command: unknown, options?: { abortSignal?: AbortSignal }): Promise<unknown> },
	index: SegmentCacheIndex = memoryIndex()
) {
	return createTidalSegmentCache(
		{
			enabled: true,
			bucket: 'tidal-cache',
			endpoint: 'https://bucket.example.test',
			accessKeyId: 'key',
			secretAccessKey: 'secret'
		},
		client,
		index
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

	it('records a written object so the sweeper can find it later', async () => {
		// The bucket cannot be listed, so an unrecorded object is unreclaimable.
		const index = memoryIndex();
		const cache = configuredCache({ send: vi.fn().mockResolvedValue({}) }, index);

		await cache.put({ cacheKey, bytes: new Uint8Array([1, 2, 3]), contentType: 'audio/mp4' });

		expect(index.rows.size).toBe(1);
		const [entry] = [...index.rows.values()];
		expect(entry.sizeBytes).toBe(3);
		expect(entry.expiresAt.getTime()).toBeGreaterThan(Date.now());
		// The key is a salted-prefix digest, not the track identity in the clear.
		expect(entry.objectKey).toMatch(/^syn-tidal-cache\/v1\/[0-9a-f]{64}\.mp4$/);
		expect(entry.objectKey).toBe(
			`syn-tidal-cache/v1/${createHash('sha256').update(cacheKey).digest('hex')}.mp4`
		);
	});

	it('does not record an object whose write failed', async () => {
		const index = memoryIndex();
		const cache = configuredCache(
			{ send: vi.fn().mockRejectedValue(new Error('store down')) },
			index
		);

		await expect(
			cache.put({ cacheKey, bytes: new Uint8Array([1]), contentType: 'audio/mp4' })
		).rejects.toThrow();
		// An entry with no object would make the sweeper delete nothing forever.
		expect(index.rows.size).toBe(0);
	});

	it('deletes expired objects and forgets them', async () => {
		const past = new Date(Date.now() - 60_000);
		const future = new Date(Date.now() + 60_000);
		const index = memoryIndex([
			{ objectKey: 'syn-tidal-cache/v1/aaa.mp4', expiresAt: past, sizeBytes: 10 },
			{ objectKey: 'syn-tidal-cache/v1/bbb.mp4', expiresAt: past, sizeBytes: 20 },
			{ objectKey: 'syn-tidal-cache/v1/ccc.mp4', expiresAt: future, sizeBytes: 30 }
		]);
		const send = vi.fn().mockResolvedValue({});
		const cache = configuredCache({ send }, index);

		expect(await cache.sweep()).toBe(2);
		expect(send).toHaveBeenCalledTimes(2);
		// The unexpired object is untouched and still tracked.
		expect([...index.rows.keys()]).toEqual(['syn-tidal-cache/v1/ccc.mp4']);
	});

	it('keeps the row when a delete fails so a later sweep retries it', async () => {
		const index = memoryIndex([
			{ objectKey: 'syn-tidal-cache/v1/aaa.mp4', expiresAt: new Date(Date.now() - 1), sizeBytes: 1 }
		]);
		const cache = configuredCache(
			{ send: vi.fn().mockRejectedValue(new Error('store down')) },
			index
		);

		expect(await cache.sweep()).toBe(0);
		expect(index.rows.size).toBe(1);
	});

	it('sweeps nothing, and touches the store not at all, when none have expired', async () => {
		const index = memoryIndex([
			{
				objectKey: 'syn-tidal-cache/v1/aaa.mp4',
				expiresAt: new Date(Date.now() + 60_000),
				sizeBytes: 1
			}
		]);
		const send = vi.fn();
		const cache = configuredCache({ send }, index);

		expect(await cache.sweep()).toBe(0);
		expect(send).not.toHaveBeenCalled();
	});

	it('is a no-op on a cache that is not configured', async () => {
		expect(await createTidalSegmentCache({ enabled: false }).sweep()).toBe(0);
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
