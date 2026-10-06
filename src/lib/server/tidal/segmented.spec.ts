import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	__resetSegmentCache,
	__resetSweepThrottle,
	headSegmentedAudio,
	parseByteRange,
	streamSegmentedAudio
} from './segmented';

afterEach(() => __resetSegmentCache());

/**
 * Fetch mock where fragment `?i=N` resolves to `size` bytes all valued N.
 *
 * `HEAD` answers with the size only, mirroring the probe the streaming path uses
 * to learn the total before any body moves. Pass `headSupported: false` for a CDN
 * that refuses `HEAD` on signed URLs, which forces the buffered fallback.
 */
function fragmentFetch(size = 4, { headSupported = true } = {}) {
	const fn = vi.fn(async (url: string, init?: RequestInit) => {
		const idx = Number(new URL(url).searchParams.get('i'));
		if (init?.method === 'HEAD') {
			return headSupported
				? new Response(null, { status: 200, headers: { 'content-length': String(size) } })
				: new Response(null, { status: 405 });
		}
		return new Response(new Uint8Array(size).fill(idx));
	});
	return fn as typeof fn & typeof fetch;
}

/** Body-fetch calls only — the `HEAD` probe is not a download. */
function bodyFetches(f: ReturnType<typeof fragmentFetch>): unknown[] {
	return f.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method !== 'HEAD');
}

function urls(count: number): string[] {
	return Array.from({ length: count }, (_, i) => `https://cdn.test/seg?i=${i}`);
}

async function body(res: Response): Promise<Uint8Array> {
	return new Uint8Array(await res.arrayBuffer());
}

describe('parseByteRange', () => {
	it('returns null for no header or an unparseable header', () => {
		expect(parseByteRange(null, 100)).toBeNull();
		expect(parseByteRange('bytes=', 100)).toBeNull();
		expect(parseByteRange('items=0-1', 100)).toBeNull();
	});

	it('parses a closed range and clamps the end to the last byte', () => {
		expect(parseByteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
		expect(parseByteRange('bytes=90-999', 100)).toEqual({ start: 90, end: 99 });
	});

	it('treats an open-ended range as "to the end"', () => {
		expect(parseByteRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
	});

	it('resolves a suffix range against the size', () => {
		expect(parseByteRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
		expect(parseByteRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
	});

	it('rejects an unsatisfiable range', () => {
		expect(parseByteRange('bytes=100-200', 100)).toBeNull();
		expect(parseByteRange('bytes=50-10', 100)).toBeNull();
	});
});

describe('streamSegmentedAudio', () => {
	it('falls back to assembly when a successful HEAD omits Content-Length', async () => {
		const f = vi.fn(
			async (_url: string, init?: RequestInit) =>
				new Response(init?.method === 'HEAD' ? null : new Uint8Array([1, 2, 3]))
		) as unknown as typeof fetch;
		const res = await streamSegmentedAudio({
			key: 'track-no-length',
			urls: urls(2),
			mimeType: 'audio/mp4',
			fetchImpl: f
		});

		expect(res.headers.get('Content-Length')).toBe('6');
		expect(await body(res)).toEqual(new Uint8Array([1, 2, 3, 1, 2, 3]));
	});
	it('downloads every fragment once and concatenates them in order', async () => {
		const f = fragmentFetch();
		const res = await streamSegmentedAudio({
			key: 'track-1:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		});

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('audio/mp4');
		// Probed up front, so the element can seek from the very first response.
		expect(res.headers.get('Content-Length')).toBe('12');
		expect(res.headers.get('Accept-Ranges')).toBe('bytes');
		expect(await body(res)).toEqual(new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]));
		expect(bodyFetches(f)).toHaveLength(3);
	});

	it('emits the first fragment before the last one has downloaded', async () => {
		// The point of the streaming path: time-to-first-byte should not wait out
		// the whole track.
		let releaseLast: () => void = () => {};
		const held = new Promise<void>((resolve) => {
			releaseLast = resolve;
		});
		const f = vi.fn(async (url: string, init?: RequestInit) => {
			const idx = Number(new URL(url).searchParams.get('i'));
			if (init?.method === 'HEAD') {
				return new Response(null, { status: 200, headers: { 'content-length': '4' } });
			}
			if (idx === 2) await held;
			return new Response(new Uint8Array(4).fill(idx));
		}) as ReturnType<typeof vi.fn> & typeof fetch;

		const res = await streamSegmentedAudio({
			key: 'track-stream:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		});

		const reader = res.body!.getReader();
		const first = await reader.read();
		expect(first.value).toEqual(new Uint8Array([0, 0, 0, 0]));

		releaseLast();
		await reader.cancel();
	});

	it('aborts pending fragments and does not cache a cancelled opening stream', async () => {
		let releaseLast: () => void = () => {};
		const held = new Promise<void>((resolve) => {
			releaseLast = resolve;
		});
		const f = vi.fn((url: string, init?: RequestInit) => {
			const idx = Number(new URL(url).searchParams.get('i'));
			if (init?.method === 'HEAD') {
				return Promise.resolve(
					new Response(null, { status: 200, headers: { 'content-length': '4' } })
				);
			}
			if (idx !== 2) return Promise.resolve(new Response(new Uint8Array(4).fill(idx)));
			return new Promise<Response>((resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
				// `held` is only ever resolved, by `releaseLast`; rejection is the abort path above.
				void held.then(() => resolve(new Response(new Uint8Array(4).fill(idx))));
			});
		}) as ReturnType<typeof vi.fn> & typeof fetch;
		const opts = {
			key: 'track-cancel:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		};

		const opening = await streamSegmentedAudio(opts);
		const reader = opening.body!.getReader();
		await reader.read();
		await reader.cancel('user skipped');
		releaseLast();
		await vi.waitFor(() =>
			expect(
				f.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method !== 'HEAD')
			).toHaveLength(3)
		);

		const replay = await streamSegmentedAudio({ ...opts, rangeHeader: 'bytes=0-3' });
		expect(await body(replay)).toEqual(new Uint8Array([0, 0, 0, 0]));
		expect(
			f.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method !== 'HEAD')
		).toHaveLength(6);
	});

	it('falls back to buffering when the CDN will not answer HEAD', async () => {
		const f = fragmentFetch(4, { headSupported: false });
		const res = await streamSegmentedAudio({
			key: 'track-nohead:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		});

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Length')).toBe('12');
		expect(await body(res)).toEqual(new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]));
		expect(bodyFetches(f)).toHaveLength(3);
	});

	it('retries a transient HEAD probe before streaming fragments', async () => {
		let firstProbe = true;
		const f = vi.fn(async (url: string, init?: RequestInit) => {
			const idx = Number(new URL(url).searchParams.get('i'));
			if (init?.method === 'HEAD') {
				if (firstProbe) {
					firstProbe = false;
					return new Response(null, { status: 503 });
				}
				return new Response(null, { status: 200, headers: { 'content-length': '4' } });
			}
			return new Response(new Uint8Array(4).fill(idx));
		}) as ReturnType<typeof vi.fn> & typeof fetch;

		const response = await streamSegmentedAudio({
			key: 'track-probe-retry:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		});

		expect(await body(response)).toHaveLength(12);
		expect(f.mock.calls.filter(([, init]) => init?.method === 'HEAD')).toHaveLength(4);
	});

	it('serves an eligible durable cache hit without touching the TIDAL CDN', async () => {
		const f = fragmentFetch();
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue({
				body: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new Uint8Array([4, 5, 6]));
						controller.close();
					}
				}),
				contentLength: 3,
				contentType: 'audio/mp4'
			}),
			put: vi.fn(),
			sweep: vi.fn().mockResolvedValue(0)
		};
		const response = await streamSegmentedAudio({
			key: 'track-durable:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f,
			persistentCache
		});

		expect(await body(response)).toEqual(new Uint8Array([4, 5, 6]));
		expect(f).not.toHaveBeenCalled();
	});

	it('forwards a durable-cache range through Syn without touching TIDAL', async () => {
		const f = fragmentFetch();
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue({
				body: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new Uint8Array([4, 5]));
						controller.close();
					}
				}),
				contentLength: 2,
				contentRange: 'bytes 4-5/12',
				contentType: 'audio/mp4'
			}),
			put: vi.fn(),
			sweep: vi.fn().mockResolvedValue(0)
		};
		const response = await streamSegmentedAudio({
			key: 'track-durable-range:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f,
			rangeHeader: 'bytes=4-5',
			persistentCache
		});

		expect(response.status).toBe(206);
		expect(response.headers.get('Content-Range')).toBe('bytes 4-5/12');
		expect(await body(response)).toEqual(new Uint8Array([4, 5]));
		expect(persistentCache.get).toHaveBeenCalledWith(
			'track-durable-range:HI_RES_LOSSLESS',
			'bytes=4-5'
		);
		expect(f).not.toHaveBeenCalled();
	});

	it('closes an incompatible durable range body before falling back to TIDAL', async () => {
		const f = fragmentFetch();
		let cancelled = false;
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue({
				body: new ReadableStream<Uint8Array>({
					cancel() {
						cancelled = true;
					}
				}),
				contentLength: 12,
				contentType: 'audio/mp4'
			}),
			put: vi.fn().mockResolvedValue(undefined),
			sweep: vi.fn().mockResolvedValue(0)
		};
		const response = await streamSegmentedAudio({
			key: 'track-durable-bad-range:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f,
			rangeHeader: 'bytes=0-3',
			persistentCache
		});

		expect(response.status).toBe(206);
		expect(cancelled).toBe(true);
		expect(await body(response)).toEqual(new Uint8Array([0, 0, 0, 0]));
	});

	it('sweeps expired objects after a write, then throttles further sweeps', async () => {
		// The bucket supports neither listing nor lifecycle rules, so a write is
		// the only moment Syn reliably gets to reclaim what has expired.
		__resetSweepThrottle();
		const sweep = vi.fn().mockResolvedValue(0);
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			sweep
		};
		const play = async (key: string) =>
			body(
				await streamSegmentedAudio({
					key,
					urls: urls(2),
					mimeType: 'audio/mp4',
					fetchImpl: fragmentFetch(),
					persistentCache
				})
			);

		await play('track-sweep-a:HI_RES_LOSSLESS');
		await vi.waitFor(() => expect(sweep).toHaveBeenCalledTimes(1));

		// A second write moments later must not sweep again.
		await play('track-sweep-b:HI_RES_LOSSLESS');
		await vi.waitFor(() => expect(persistentCache.put).toHaveBeenCalledTimes(2));
		expect(sweep).toHaveBeenCalledTimes(1);
	});

	it('never lets a failing sweep affect playback', async () => {
		__resetSweepThrottle();
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			sweep: vi.fn().mockRejectedValue(new Error('store down'))
		};

		const response = await streamSegmentedAudio({
			key: 'track-sweep-fail:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: fragmentFetch(),
			persistentCache
		});

		expect(await body(response)).toEqual(new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]));
		await vi.waitFor(() => expect(persistentCache.sweep).toHaveBeenCalled());
	});

	it('writes only a completed assembly to the enabled durable cache', async () => {
		const f = fragmentFetch();
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			sweep: vi.fn().mockResolvedValue(0)
		};
		const response = await streamSegmentedAudio({
			key: 'track-durable-write:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f,
			persistentCache
		});
		await body(response);

		await vi.waitFor(() => expect(persistentCache.put).toHaveBeenCalledTimes(1));
		expect(persistentCache.put).toHaveBeenCalledWith(
			expect.objectContaining({
				cacheKey: 'track-durable-write:HI_RES_LOSSLESS',
				contentType: 'audio/mp4',
				bytes: expect.any(Uint8Array)
			})
		);
	});

	it('uses durable-cache metadata for HEAD without touching TIDAL fragments', async () => {
		const f = fragmentFetch();
		const persistentCache = {
			enabled: true,
			head: vi.fn().mockResolvedValue({ contentLength: 12, contentType: 'audio/mp4' }),
			get: vi.fn(),
			put: vi.fn(),
			sweep: vi.fn().mockResolvedValue(0)
		};
		const response = await headSegmentedAudio({
			key: 'track-durable-head:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f,
			persistentCache
		});

		expect(response.headers.get('Content-Length')).toBe('12');
		expect(f).not.toHaveBeenCalled();
	});

	it('downloads a track once when two requests race for it', async () => {
		const f = fragmentFetch();
		const opts = {
			key: 'track-race:HI_RES_LOSSLESS',
			urls: urls(4),
			mimeType: 'audio/mp4',
			fetchImpl: f
		};

		// Two range requests arrive together against a cold cache.
		const [a, b] = await Promise.all([
			streamSegmentedAudio({ ...opts, rangeHeader: 'bytes=0-3' }),
			streamSegmentedAudio({ ...opts, rangeHeader: 'bytes=8-11' })
		]);

		expect(a.status).toBe(206);
		expect(b.status).toBe(206);
		expect(bodyFetches(f)).toHaveLength(4);
	});

	it('does not start a second body download for concurrent cold full requests', async () => {
		const f = fragmentFetch();
		const opts = {
			key: 'track-full-race:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		};

		const first = await streamSegmentedAudio(opts);
		const second = streamSegmentedAudio(opts);
		await body(first);
		const repeated = await second;

		expect(await body(repeated)).toEqual(new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]));
		expect(bodyFetches(f)).toHaveLength(3);
	});

	it('reserves the assembly while probing so a concurrent range cannot race it', async () => {
		let releaseHeads: () => void = () => {};
		const headsHeld = new Promise<void>((resolve) => {
			releaseHeads = resolve;
		});
		const f = vi.fn(async (url: string, init?: RequestInit) => {
			const idx = Number(new URL(url).searchParams.get('i'));
			if (init?.method === 'HEAD') {
				await headsHeld;
				return new Response(null, { status: 200, headers: { 'content-length': '4' } });
			}
			return new Response(new Uint8Array(4).fill(idx));
		}) as ReturnType<typeof vi.fn> & typeof fetch;
		const opts = {
			key: 'track-probe-race:HI_RES_LOSSLESS',
			urls: urls(3),
			mimeType: 'audio/mp4',
			fetchImpl: f
		};

		const opening = streamSegmentedAudio(opts);
		await vi.waitFor(() => expect(f).toHaveBeenCalled());
		const range = streamSegmentedAudio({ ...opts, rangeHeader: 'bytes=4-7' });
		releaseHeads();

		await body(await opening);
		const ranged = await range;
		expect(ranged.status).toBe(206);
		expect(await body(ranged)).toEqual(new Uint8Array([1, 1, 1, 1]));
		expect(
			f.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method !== 'HEAD')
		).toHaveLength(3);
	});

	it('serves a 206 slice and reuses the cached buffer on the next call', async () => {
		const f = fragmentFetch();
		const opts = {
			key: 'track-2:HI_RES_LOSSLESS',
			urls: urls(4),
			mimeType: 'audio/mp4',
			fetchImpl: f
		};

		// Drain the streamed first response so the assembly reaches the cache.
		await body(await streamSegmentedAudio(opts));
		f.mockClear();

		const res = await streamSegmentedAudio({ ...opts, rangeHeader: 'bytes=6-11' });
		expect(res.status).toBe(206);
		expect(res.headers.get('Content-Range')).toBe('bytes 6-11/16');
		expect(res.headers.get('Content-Length')).toBe('6');
		expect(await body(res)).toEqual(new Uint8Array([1, 1, 2, 2, 2, 2]));
		expect(f).not.toHaveBeenCalled();
	});

	it('returns 416 for an unsatisfiable range', async () => {
		const res = await streamSegmentedAudio({
			key: 'track-3:HI_RES_LOSSLESS',
			urls: urls(2),
			mimeType: 'audio/mp4',
			fetchImpl: fragmentFetch(),
			rangeHeader: 'bytes=999-1000'
		});
		expect(res.status).toBe(416);
		expect(res.headers.get('Content-Range')).toBe('bytes */8');
	});

	it('throws when a fragment fails', async () => {
		const f = vi.fn(async (url: string) => {
			if (url.endsWith('i=1')) return new Response('nope', { status: 404 });
			return new Response(new Uint8Array(4));
		}) as ReturnType<typeof vi.fn> & typeof fetch;

		await expect(
			streamSegmentedAudio({
				key: 'track-4:HI_RES_LOSSLESS',
				urls: urls(3),
				mimeType: 'audio/mp4',
				fetchImpl: f
			})
		).rejects.toThrow(/Segment 1/);
	});

	it('evicts the oldest entry once more than three tracks are cached', async () => {
		const f = fragmentFetch();
		const play = async (key: string) =>
			body(await streamSegmentedAudio({ key, urls: urls(1), mimeType: 'audio/mp4', fetchImpl: f }));

		for (const key of ['a', 'b', 'c', 'd']) await play(key);
		const before = bodyFetches(f).length;

		// 'a' was evicted -> re-fetched; 'd' is still hot -> not re-fetched.
		await play('a');
		await play('d');

		expect(bodyFetches(f).length).toBe(before + 1);
	});
});
