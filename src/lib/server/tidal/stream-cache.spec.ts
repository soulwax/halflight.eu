import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralCache } from '#lib/server/cache';
import {
	__resetStreamCache,
	invalidateStreamCache,
	resolveTrackStreamCached
} from './stream-cache';
import type { ResolvedStreamInfo } from './stream';

function memoryCache(): EphemeralCache & { store: Map<string, string> } {
	const store = new Map<string, string>();
	return {
		store,
		get: (key) => Promise.resolve(store.get(key) ?? null),
		set: (key, value) => {
			store.set(key, value);
			return Promise.resolve();
		},
		delete: (key) => {
			store.delete(key);
			return Promise.resolve();
		}
	};
}

/** A cache whose every operation throws, to prove the wrapper fails open. */
const brokenCache: EphemeralCache = {
	get: () => Promise.reject(new Error('redis down')),
	set: () => Promise.reject(new Error('redis down')),
	delete: () => Promise.reject(new Error('redis down'))
};

const info = {
	trackId: 123,
	streamUrl: 'https://cdn.example.test/audio?token=secret-capability',
	urls: ['https://cdn.example.test/audio?token=secret-capability'],
	fileExtension: '.flac',
	mimeType: 'audio/flac',
	codecs: 'flac',
	segmented: false,
	audioMode: 'STEREO',
	audioQuality: 'LOSSLESS'
} as ResolvedStreamInfo;

beforeEach(() => {
	__resetStreamCache();
});

describe('resolveTrackStreamCached', () => {
	it('resolves once and serves the memoised manifest on the next call', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		const first = await resolveTrackStreamCached('123', {
			userId: 'u1',
			quality: 'LOSSLESS',
			cache,
			resolve
		});
		const second = await resolveTrackStreamCached('123', {
			userId: 'u1',
			quality: 'LOSSLESS',
			cache,
			resolve
		});

		expect(first).toEqual(info);
		expect(second).toEqual(info);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('collapses concurrent resolutions into one upstream call', async () => {
		// The `/stream` + `/audio` pair the player issues on track start.
		let release: (value: ResolvedStreamInfo) => void = () => {};
		const resolve = vi.fn().mockReturnValue(
			new Promise<ResolvedStreamInfo>((r) => {
				release = r;
			})
		);
		const cache = memoryCache();

		const both = Promise.all([
			resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve }),
			resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve })
		]);
		release(info);

		expect(await both).toEqual([info, info]);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('keys by quality so a tier change re-resolves', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });
		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'HIGH', cache, resolve });

		expect(resolve).toHaveBeenCalledTimes(2);
	});

	it('seals the shared entry so signed CDN URLs never sit in Redis as plaintext', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });

		const stored = [...cache.store.values()];
		expect(stored).toHaveLength(1);
		expect(stored[0]).not.toContain('secret-capability');
		expect(stored[0]).not.toContain('cdn.example.test');
	});

	it('recovers a manifest from the shared tier after the process-local one is lost', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });
		// Stands in for `pnpm pm2:reload`: the process restarts, Redis does not.
		__resetStreamCache();

		expect(
			await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve })
		).toEqual(info);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('still resolves when the shared cache is unreachable', async () => {
		const resolve = vi.fn().mockResolvedValue(info);

		expect(
			await resolveTrackStreamCached('123', {
				userId: 'u1',
				quality: 'LOSSLESS',
				cache: brokenCache,
				resolve
			})
		).toEqual(info);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('does not memoise a failed resolution', async () => {
		const resolve = vi
			.fn()
			.mockRejectedValueOnce(new Error('upstream 502'))
			.mockResolvedValue(info);
		const cache = memoryCache();

		await expect(
			resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve })
		).rejects.toThrow('upstream 502');
		expect(
			await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve })
		).toEqual(info);
		expect(resolve).toHaveBeenCalledTimes(2);
	});

	it('never serves one user a manifest resolved for another', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });
		await resolveTrackStreamCached('123', { userId: 'u2', quality: 'LOSSLESS', cache, resolve });

		expect(resolve).toHaveBeenCalledTimes(2);
		expect(cache.store.size).toBe(2);
	});

	it('does not cache a request without a user id', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { quality: 'LOSSLESS', cache, resolve });
		await resolveTrackStreamCached('123', { quality: 'LOSSLESS', cache, resolve });

		expect(resolve).toHaveBeenCalledTimes(2);
		expect(cache.store.size).toBe(0);
	});

	it('invalidates only the disconnecting user', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });
		await resolveTrackStreamCached('123', { userId: 'u2', quality: 'LOSSLESS', cache, resolve });
		await invalidateStreamCache('u1', cache);
		await resolveTrackStreamCached('123', { userId: 'u2', quality: 'LOSSLESS', cache, resolve });

		expect(resolve).toHaveBeenCalledTimes(2);
	});

	it('bypasses the cache for a track id that cannot be keyed safely', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		// A colon would let one id address another's cache entry.
		await resolveTrackStreamCached('123:456', {
			userId: 'u1',
			quality: 'LOSSLESS',
			cache,
			resolve
		});
		await resolveTrackStreamCached('123:456', {
			userId: 'u1',
			quality: 'LOSSLESS',
			cache,
			resolve
		});

		expect(resolve).toHaveBeenCalledTimes(2);
		expect(cache.store.size).toBe(0);
	});

	it('drops every memoised manifest on invalidation', async () => {
		const resolve = vi.fn().mockResolvedValue(info);
		const cache = memoryCache();

		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });
		await invalidateStreamCache('u1', cache);
		expect(cache.store.size).toBe(0);

		// Both tiers are gone, so the next play resolves afresh.
		await resolveTrackStreamCached('123', { userId: 'u1', quality: 'LOSSLESS', cache, resolve });
		expect(resolve).toHaveBeenCalledTimes(2);
	});
});
