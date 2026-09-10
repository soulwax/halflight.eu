import { TidalError } from './errors';
import { withTransientRetry } from './retry';
import type { TidalSegmentCache } from './segment-cache-bucket';

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
 * The opening (rangeless) request does not wait for the whole track. A parallel
 * sweep of `HEAD` probes establishes the total size, and fragments are then
 * written into one pre-allocated buffer and emitted as they arrive — so the
 * element gets its first bytes after roughly one fragment instead of ~1-3 s for
 * a 4-minute 24-bit/96 kHz track, while still receiving a correct
 * `Content-Length` and so keeping seeking intact. A CDN that will not answer
 * `HEAD` falls back to assembling the whole track first.
 *
 * Range requests against a cold cache still assemble up front, since they need
 * random access. Either way the assembly is single-flighted, so concurrent
 * first-plays of one track download it once.
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
	assembling.clear();
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

function persistCompletedAssembly(
	cacheStore: TidalSegmentCache,
	cacheKey: string,
	bytes: ArrayBuffer,
	contentType: string
): void {
	if (!cacheStore.enabled) return;
	// Persistence is an optimisation, never part of the playback critical path.
	// Do not await it and never let an object-store error affect the caller.
	void Promise.resolve()
		.then(() => cacheStore.put({ cacheKey, bytes: new Uint8Array(bytes), contentType }))
		.catch(() => undefined);
}

function cacheCompletedAssembly(options: StreamSegmentedOptions, bytes: ArrayBuffer): void {
	evict(bytes.byteLength);
	cache.set(options.key, { bytes, storedAt: Date.now() });
	if (options.persistentCache) {
		persistCompletedAssembly(options.persistentCache, options.key, bytes, options.mimeType);
	}
}

class SegmentFetchError extends TidalError {
	constructor(
		readonly status: number,
		readonly index: number
	) {
		super(`Segment ${index} fetch failed with status ${status}`);
	}
}

async function fetchSegment(
	index: number,
	urls: string[],
	fetchImpl: typeof fetch,
	upstreamHeaders: HeadersInit | undefined,
	signal?: AbortSignal
): Promise<Uint8Array> {
	// Retry per fragment: one transient 5xx would otherwise discard the whole
	// already-mostly-downloaded track.
	const res = await withTransientRetry(
		() => fetchImpl(urls[index], { headers: upstreamHeaders, redirect: 'follow', signal }),
		{ signal }
	);
	if (!res.ok && res.status !== 206) throw new SegmentFetchError(res.status, index);
	return new Uint8Array(await res.arrayBuffer());
}

async function downloadAndConcat(
	urls: string[],
	fetchImpl: typeof fetch,
	upstreamHeaders: HeadersInit | undefined,
	signal?: AbortSignal
): Promise<ArrayBuffer> {
	const parts = new Array<Uint8Array | undefined>(urls.length);
	let cursor = 0;

	async function worker(): Promise<void> {
		for (let i = cursor++; i < urls.length; i = cursor++) {
			parts[i] = await fetchSegment(i, urls, fetchImpl, upstreamHeaders, signal);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(FETCH_CONCURRENCY, urls.length) }, () => worker())
	);

	const total = parts.reduce((sum, part) => sum + (part?.byteLength ?? 0), 0);
	const merged = new Uint8Array(new ArrayBuffer(total));
	let offset = 0;
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!part) continue;
		merged.set(part, offset);
		offset += part.byteLength;
		// Release each fragment as it lands in the merged buffer, so the peak is
		// one copy of the track rather than two.
		parts[i] = undefined;
	}
	return merged.buffer;
}

/**
 * Total size of the assembled stream, from one parallel sweep of `HEAD` probes.
 *
 * Returns `null` if any probe fails or omits `content-length` — some CDNs do not
 * answer `HEAD` on signed URLs — in which case the caller falls back to
 * assembling the whole track before responding.
 */
async function probeTotalSize(
	urls: string[],
	fetchImpl: typeof fetch,
	upstreamHeaders: HeadersInit | undefined,
	signal?: AbortSignal
): Promise<number | null> {
	const sizes = new Array<number>(urls.length);
	let cursor = 0;
	let usable = true;

	async function worker(): Promise<void> {
		for (let i = cursor++; i < urls.length && usable; i = cursor++) {
			const res = await withTransientRetry(
				() =>
					fetchImpl(urls[i], {
						method: 'HEAD',
						headers: upstreamHeaders,
						redirect: 'follow',
						signal
					}),
				{ signal }
			);
			const length = Number(res.headers.get('content-length'));
			if (!res.ok || !Number.isSafeInteger(length) || length < 0) {
				usable = false;
				return;
			}
			sizes[i] = length;
		}
	}

	try {
		await Promise.all(
			Array.from({ length: Math.min(FETCH_CONCURRENCY, urls.length) }, () => worker())
		);
	} catch (cause) {
		if (signal?.aborted) throw cause;
		return null;
	}
	if (!usable) return null;
	return sizes.reduce((sum, size) => sum + size, 0);
}

/**
 * Assemble the track into one pre-allocated buffer, emitting each fragment to the
 * client as it lands rather than after the last one.
 *
 * Because `total` is known up front the response carries a correct
 * `Content-Length`, so the element can still seek — and because every fragment is
 * written straight into the final buffer there is no second merge copy. The
 * enqueued views alias regions that are already written and never rewritten.
 *
 * Keeps `FETCH_CONCURRENCY` requests in flight while emitting strictly in order.
 */
function streamAndCache(
	options: StreamSegmentedOptions,
	total: number,
	done: PendingAssembly
): ReadableStream<Uint8Array> {
	const { urls, fetchImpl, upstreamHeaders } = options;
	const abort = new AbortController();
	const abortForRequest = () => abort.abort(options.signal?.reason);
	options.signal?.addEventListener('abort', abortForRequest, { once: true });
	const merged = new Uint8Array(new ArrayBuffer(total));
	const pending = new Array<Promise<Uint8Array> | undefined>(urls.length);

	function start(index: number): void {
		if (index >= urls.length) return;
		const promise = fetchSegment(index, urls, fetchImpl, upstreamHeaders, abort.signal);
		// Same reasoning: the in-order loop below surfaces the real failure.
		promise.catch(() => undefined);
		pending[index] = promise;
	}

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for (let i = 0; i < Math.min(FETCH_CONCURRENCY, urls.length); i++) start(i);

				let offset = 0;
				for (let i = 0; i < urls.length; i++) {
					const part = await pending[i]!;
					pending[i] = undefined;
					if (offset + part.byteLength > total) {
						throw new TidalError('Segmented stream is larger than its probed size');
					}
					merged.set(part, offset);
					controller.enqueue(merged.subarray(offset, offset + part.byteLength));
					offset += part.byteLength;
					start(i + FETCH_CONCURRENCY);
				}

				if (offset !== total) {
					throw new TidalError('Segmented stream is smaller than its probed size');
				}
				// Only a complete assembly is worth caching — a client that aborts
				// mid-stream must not leave a truncated track behind.
				cacheCompletedAssembly(options, merged.buffer);
				controller.close();
				done.resolve(merged.buffer);
			} catch (cause) {
				controller.error(cause);
				done.reject(cause);
			} finally {
				options.signal?.removeEventListener('abort', abortForRequest);
				if (assembling.get(options.key) === done.promise) assembling.delete(options.key);
			}
		},
		cancel(reason) {
			// Do not keep downloading or cache a track after the browser has
			// abandoned its opening request. A later play starts cleanly.
			abort.abort(reason);
			options.signal?.removeEventListener('abort', abortForRequest);
			done.reject(reason ?? new DOMException('The stream was cancelled.', 'AbortError'));
			if (assembling.get(options.key) === done.promise) assembling.delete(options.key);
		}
	});
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
	/** Caching/validator headers to merge into the response (`Cache-Control`, `ETag`). */
	responseHeaders?: HeadersInit;
	/** Abort source for a disconnected browser request. */
	signal?: AbortSignal;
	/** Optional server-only durable cache. Disabled by default and injectable for tests. */
	persistentCache?: TidalSegmentCache;
}

function responseHeadersFor(options: StreamSegmentedOptions): Headers {
	const headers = new Headers(options.responseHeaders);
	headers.set('Content-Type', options.mimeType);
	headers.set('Accept-Ranges', 'bytes');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Vary', 'Range');
	return headers;
}

/**
 * Answer a HEAD request without beginning a fragment-body transfer. When the
 * assembled bytes are already hot we can describe the exact range; otherwise
 * the same bounded HEAD sweep used by the streaming GET supplies the total.
 * A CDN that declines HEAD still gets a useful, bodyless 200 response — the
 * following GET will take its normal buffered fallback.
 */
export async function headSegmentedAudio(options: StreamSegmentedOptions): Promise<Response> {
	const bytes = readCache(options.key);
	const headers = responseHeadersFor(options);
	const persistent =
		bytes || !options.persistentCache?.enabled
			? null
			: await options.persistentCache.head(options.key);
	const size =
		bytes?.byteLength ??
		persistent?.contentLength ??
		(await probeTotalSize(
			options.urls,
			options.fetchImpl,
			options.upstreamHeaders,
			options.signal
		));
	if (persistent) headers.set('Content-Type', persistent.contentType);

	if (size !== null) {
		if (options.rangeHeader) {
			const range = parseByteRange(options.rangeHeader, size);
			if (!range) {
				headers.set('Content-Range', `bytes */${size}`);
				return new Response(null, { status: 416, headers });
			}
			const length = range.end - range.start + 1;
			headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
			headers.set('Content-Length', String(length));
			return new Response(null, { status: 206, headers });
		}

		headers.set('Content-Length', String(size));
	}

	return new Response(null, { status: 200, headers });
}

async function responseFromPersistentCache(
	options: StreamSegmentedOptions
): Promise<Response | null> {
	if (!options.persistentCache?.enabled) return null;
	const cached = await options.persistentCache.get(options.key, options.rangeHeader);
	if (!cached) return null;
	if (options.rangeHeader && !cached.contentRange) {
		await cached.body.cancel().catch(() => undefined);
		return null;
	}

	const headers = responseHeadersFor(options);
	headers.set('Content-Type', cached.contentType);
	if (cached.contentLength !== undefined) {
		headers.set('Content-Length', String(cached.contentLength));
	}
	if (cached.contentRange) headers.set('Content-Range', cached.contentRange);
	return new Response(cached.body, {
		status: cached.contentRange ? 206 : 200,
		headers
	});
}

/**
 * In-flight assemblies, keyed like the cache — both the buffered path and the
 * streaming one publish here, so any request arriving mid-assembly waits for the
 * download already running instead of starting its own.
 */
const assembling = new Map<string, Promise<ArrayBuffer>>();

interface PendingAssembly {
	promise: Promise<ArrayBuffer>;
	resolve(bytes: ArrayBuffer): void;
	reject(cause: unknown): void;
}

/**
 * Reserve the one assembly slot before an opening request probes fragment
 * sizes. That closes the HEAD-probe race: a concurrent full or Range request
 * observes this promise instead of starting a duplicate download while the
 * first request is still learning the final Content-Length.
 */
function reserveAssembly(key: string): PendingAssembly {
	let resolve: (bytes: ArrayBuffer) => void = () => {};
	let reject: (cause: unknown) => void = () => {};
	const promise = new Promise<ArrayBuffer>((settle, fail) => {
		resolve = settle;
		reject = fail;
	});
	// The initiating stream surfaces a failure through its body. This catch only
	// prevents Node reporting a rejected reservation before a concurrent Range
	// request attaches its own handler.
	promise.catch(() => undefined);
	assembling.set(key, promise);
	return { promise, resolve, reject };
}

/**
 * Assemble a track exactly once even if several requests race for it. Without
 * this, two concurrent first-plays each downloaded and concatenated the whole
 * thing.
 */
function assembleOnce(options: StreamSegmentedOptions): Promise<ArrayBuffer> {
	const existing = assembling.get(options.key);
	if (existing) return existing;

	const pending = downloadAndConcat(
		options.urls,
		options.fetchImpl,
		options.upstreamHeaders,
		options.signal
	)
		.then((bytes) => {
			cacheCompletedAssembly(options, bytes);
			return bytes;
		})
		.finally(() => {
			assembling.delete(options.key);
		});

	assembling.set(options.key, pending);
	return pending;
}

/**
 * Resolve a segmented stream to a single `Response`, concatenating fragments on
 * the first request and serving `Range` slices from cache thereafter.
 */
export async function streamSegmentedAudio(options: StreamSegmentedOptions): Promise<Response> {
	let bytes = readCache(options.key);
	if (!bytes) {
		const persisted = await responseFromPersistentCache(options);
		if (persisted) return persisted;
	}
	const inFlight = !bytes ? assembling.get(options.key) : undefined;

	// A second cold request never starts another assembly. It waits for the
	// request that reserved this key, then gets the normal byte/range response
	// below. The first request still streams immediately.
	if (inFlight) bytes = await inFlight;

	if (!bytes && !options.rangeHeader) {
		const reservation = reserveAssembly(options.key);
		// The element's opening request. Emit fragments as they arrive instead of
		// making it wait out the whole track — provided the CDN will tell us the
		// total, without which the response could not carry a `Content-Length` and
		// seeking would break.
		try {
			const total = await probeTotalSize(
				options.urls,
				options.fetchImpl,
				options.upstreamHeaders,
				options.signal
			);
			if (total !== null && total > 0) {
				const headers = responseHeadersFor(options);
				headers.set('Content-Length', String(total));
				return new Response(streamAndCache(options, total, reservation), { status: 200, headers });
			}

			// A CDN without HEAD support cannot provide a safe streaming response;
			// keep the reservation and make this opening request own the buffered
			// fallback rather than letting a concurrent Range request duplicate it.
			const assembled = await downloadAndConcat(
				options.urls,
				options.fetchImpl,
				options.upstreamHeaders,
				options.signal
			);
			cacheCompletedAssembly(options, assembled);
			reservation.resolve(assembled);
			if (assembling.get(options.key) === reservation.promise) assembling.delete(options.key);
			bytes = assembled;
		} catch (cause) {
			reservation.reject(cause);
			if (assembling.get(options.key) === reservation.promise) assembling.delete(options.key);
			throw cause;
		}
	}

	if (!bytes) {
		// A range request against an uncached track needs random access, and the
		// fallback path when the CDN would not answer `HEAD`. Single-flighted so
		// concurrent first-plays of the same track download it once.
		bytes = await assembleOnce(options);
	}

	const size = bytes.byteLength;
	const headers = responseHeadersFor(options);

	if (options.rangeHeader) {
		const range = parseByteRange(options.rangeHeader, size);
		if (!range) {
			headers.set('Content-Range', `bytes */${size}`);
			return new Response(null, { status: 416, headers });
		}
		const length = range.end - range.start + 1;
		headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
		headers.set('Content-Length', String(length));
		// A view, not `.slice()` — the latter copies the whole range on every
		// request, and the browser issues many of them across a track.
		return new Response(new Uint8Array(bytes, range.start, length), { status: 206, headers });
	}

	headers.set('Content-Length', String(size));
	return new Response(bytes, { status: 200, headers });
}
