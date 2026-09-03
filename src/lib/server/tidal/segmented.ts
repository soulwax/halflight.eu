import { TidalError } from './errors';

/**
 * Segmented (MPEG-DASH) audio delivery.
 *
 * `LOW`/`HIGH`/`LOSSLESS` are single-file BTS streams — the `/audio` route
 * proxies those byte-for-byte with `Range` forwarded to the CDN. `HI_RES_LOSSLESS`
 * is an `initialization` segment plus numbered fragments, and there is no single
 * URL to range against. The reference tools (tiddl, OrpheusDL-TIDAL) simply fetch
 * every fragment in order and concatenate the bytes into one contiguous fMP4
 * stream; this does the same, then serves it with real `Range` support out of a
 * small in-memory cache so the browser's follow-up requests and seeks do not
 * re-download the track.
 *
 * Trade-off: first play waits for the whole fetch (~15-30 MB / ~1-3 s for a
 * 4-minute 24-bit/96 kHz track). Acceptable for an opt-in tier on a single-user
 * app. A durable version would stage the file to object storage via `syn-worker`.
 */

const MAX_ENTRIES = 3;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const TTL_MS = 5 * 60_000;
/** Parallel segment downloads. Order is preserved regardless (indexed writes). */
const FETCH_CONCURRENCY = 6;

interface CacheEntry {
	bytes: ArrayBuffer;
	storedAt: number;
}

/** Insertion-ordered → oldest key is first. Re-inserted on read to act as an LRU. */
const cache = new Map<string, CacheEntry>();

/** Test seam: drop everything the segment cache is holding. */
export function __resetSegmentCache(): void {
	cache.clear();
}

function evict(incomingBytes: number): void {
	const now = Date.now();
	for (const [key, entry] of cache) {
		if (now - entry.storedAt > TTL_MS) cache.delete(key);
	}
	let total = incomingBytes;
	for (const entry of cache.values()) total += entry.bytes.byteLength;
	while (cache.size >= MAX_ENTRIES || total > MAX_TOTAL_BYTES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		const dropped = cache.get(oldest);
		cache.delete(oldest);
		if (dropped) total -= dropped.bytes.byteLength;
	}
}

function readCache(key: string): ArrayBuffer | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() - entry.storedAt > TTL_MS) {
		cache.delete(key);
		return null;
	}
	// Refresh LRU position.
	cache.delete(key);
	cache.set(key, entry);
	return entry.bytes;
}

class SegmentFetchError extends TidalError {
	constructor(
		readonly status: number,
		readonly index: number
	) {
		super(`Segment ${index} fetch failed with status ${status}`);
	}
}

async function downloadAndConcat(
	urls: string[],
	fetchImpl: typeof fetch,
	upstreamHeaders: HeadersInit | undefined
): Promise<ArrayBuffer> {
	const parts = new Array<Uint8Array>(urls.length);
	let cursor = 0;

	async function worker(): Promise<void> {
		for (let i = cursor++; i < urls.length; i = cursor++) {
			const res = await fetchImpl(urls[i], { headers: upstreamHeaders, redirect: 'follow' });
			if (!res.ok && res.status !== 206) throw new SegmentFetchError(res.status, i);
			parts[i] = new Uint8Array(await res.arrayBuffer());
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(FETCH_CONCURRENCY, urls.length) }, () => worker())
	);

	const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const merged = new Uint8Array(new ArrayBuffer(total));
	let offset = 0;
	for (const part of parts) {
		merged.set(part, offset);
		offset += part.byteLength;
	}
	return merged.buffer;
}

interface ByteRange {
	start: number;
	end: number;
}

/** Parse a single `bytes=` range against a known size. `null` = no/invalid range. */
export function parseByteRange(header: string | null | undefined, size: number): ByteRange | null {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;

	const hasStart = match[1] !== '';
	const hasEnd = match[2] !== '';
	if (!hasStart && !hasEnd) return null;

	let start: number;
	let end: number;
	if (!hasStart) {
		// Suffix range: the final N bytes.
		const suffix = parseInt(match[2], 10);
		if (suffix <= 0) return null;
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = parseInt(match[1], 10);
		end = hasEnd ? parseInt(match[2], 10) : size - 1;
	}

	if (start > end || start >= size) return null;
	return { start, end: Math.min(end, size - 1) };
}

export interface StreamSegmentedOptions {
	/** Cache key — track id + delivered quality, so a re-request reuses the buffer. */
	key: string;
	/** Segment URLs in play order (DASH init segment first). */
	urls: string[];
	/** Response `Content-Type` (`audio/mp4` for HiRes fMP4). */
	mimeType: string;
	/** Injected fetch (SvelteKit `event.fetch`). */
	fetchImpl: typeof fetch;
	/** Incoming `Range` request header, if any. */
	rangeHeader?: string | null;
	/** Headers to send to the CDN for each segment (User-Agent etc.). */
	upstreamHeaders?: HeadersInit;
}

/**
 * Resolve a segmented stream to a single `Response`, concatenating fragments on
 * the first request and serving `Range` slices from cache thereafter.
 */
export async function streamSegmentedAudio(options: StreamSegmentedOptions): Promise<Response> {
	let bytes = readCache(options.key);
	if (!bytes) {
		bytes = await downloadAndConcat(options.urls, options.fetchImpl, options.upstreamHeaders);
		evict(bytes.byteLength);
		cache.set(options.key, { bytes, storedAt: Date.now() });
	}

	const size = bytes.byteLength;
	const headers = new Headers({
		'Content-Type': options.mimeType,
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
		Vary: 'Range'
	});

	if (options.rangeHeader) {
		const range = parseByteRange(options.rangeHeader, size);
		if (!range) {
			headers.set('Content-Range', `bytes */${size}`);
			return new Response(null, { status: 416, headers });
		}
		const slice = bytes.slice(range.start, range.end + 1);
		headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
		headers.set('Content-Length', String(slice.byteLength));
		return new Response(slice, { status: 206, headers });
	}

	headers.set('Content-Length', String(size));
	return new Response(bytes, { status: 200, headers });
}
