import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetSegmentCache, parseByteRange, streamSegmentedAudio } from './segmented';

afterEach(() => __resetSegmentCache());

/** Fetch mock where fragment `?i=N` resolves to `size` bytes all valued N. */
function fragmentFetch(size = 4) {
	const fn = vi.fn(async (url: string) => {
		const idx = Number(new URL(url).searchParams.get('i'));
		return new Response(new Uint8Array(size).fill(idx));
	});
	return fn as typeof fn & typeof fetch;
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
		expect(res.headers.get('Content-Length')).toBe('12');
		expect(res.headers.get('Accept-Ranges')).toBe('bytes');
		expect(await body(res)).toEqual(new Uint8Array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]));
		expect(f.mock.calls).toHaveLength(3);
	});

	it('serves a 206 slice and reuses the cached buffer on the next call', async () => {
		const f = fragmentFetch();
		const opts = {
			key: 'track-2:HI_RES_LOSSLESS',
			urls: urls(4),
			mimeType: 'audio/mp4',
			fetchImpl: f
		};

		await streamSegmentedAudio(opts);
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
		for (const key of ['a', 'b', 'c', 'd']) {
			await streamSegmentedAudio({ key, urls: urls(1), mimeType: 'audio/mp4', fetchImpl: f });
		}
		const before = f.mock.calls.length;

		// 'a' was evicted -> re-fetched; 'd' is still hot -> not re-fetched.
		await streamSegmentedAudio({ key: 'a', urls: urls(1), mimeType: 'audio/mp4', fetchImpl: f });
		await streamSegmentedAudio({ key: 'd', urls: urls(1), mimeType: 'audio/mp4', fetchImpl: f });

		expect(f.mock.calls.length).toBe(before + 1);
	});
});
