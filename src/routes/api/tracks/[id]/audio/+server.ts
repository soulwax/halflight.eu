import { error, type RequestHandler } from '@sveltejs/kit';
import {
	getRequestedStreamQuality,
	getTidalConfig,
	headSegmentedAudio,
	isTrackUnavailableForPlayback,
	resolveTrackStreamCached,
	streamSegmentedAudio,
	TidalApiError,
	TidalAuthError,
	TidalConfigError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError,
	withTransientRetry
} from '#lib/server/tidal';
import { entityTag, matchesEntityTag, rangeIsUsable } from '#lib/server/http-range';
import { log } from '#lib/server/log';

/** CDN-facing headers borrowed from the TIDAL Android client. */
const CDN_HEADERS = { Accept: '*/*', 'User-Agent': 'TIDAL_ANDROID/1039 okhttp/3.13.1' };

/**
 * How long the browser may reuse audio it has already fetched. These bytes are
 * the owner's own, on an authenticated same-origin route, so `private` caching
 * is safe — and it is what makes a backward seek free instead of a fresh CDN
 * round-trip. Kept short because the entity tag cannot see a remaster upstream.
 */
const MAX_AGE_SECONDS = 600;

/** Caching and content-sniffing headers shared by every response this route sends. */
function cacheHeaders(tag: string): Headers {
	return new Headers({
		'Cache-Control': `private, max-age=${MAX_AGE_SECONDS}`,
		ETag: tag,
		'Accept-Ranges': 'bytes',
		'X-Content-Type-Options': 'nosniff',
		Vary: 'Range'
	});
}

/**
 * Streams media through Syn so the browser never needs access to a TIDAL CDN URL.
 * Range forwarding preserves seeking in the native HTML audio player.
 */
async function serveAudio(
	event: Parameters<RequestHandler>[0],
	headOnly: boolean
): Promise<Response> {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

	// Deliberately not `getConnectionStatus()`: it costs two Postgres reads and two
	// AES-GCM decrypts to answer two questions this route can answer for free.
	// `getTidalConfig()` is memoised and reads only env, and "no device token" is
	// already `TidalPlaybackNotLinkedError` out of `getPlaybackToken` below. This
	// runs on every Range request, so the duplicated reads are worth removing.
	// `/stream` still calls it — it reports a richer status body.
	try {
		getTidalConfig();
	} catch (cause) {
		if (cause instanceof TidalConfigError) error(503, 'TIDAL not connected');
		throw cause;
	}

	let stream;
	try {
		stream = await resolveTrackStreamCached(trackId, {
			quality: await getRequestedStreamQuality(event.url, event.locals.user.id),
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
	} catch (cause) {
		if (isTrackUnavailableForPlayback(cause)) error(404, 'Track unavailable from TIDAL');
		if (cause instanceof TidalQualityDeniedError) {
			error(403, 'The requested playback quality is unavailable for this track.');
		}
		if (
			cause instanceof TidalPlaybackNotLinkedError ||
			cause instanceof TidalAuthError ||
			(cause instanceof TidalApiError && (cause.status === 401 || cause.status === 403))
		) {
			error(403, 'Full playback is not linked. Authorize playback via TIDAL Link in settings.');
		}
		error(404, 'Stream unavailable');
	}

	// Identity of these bytes. Quality matters as much as the track: the URL does
	// not encode it, so without it a preference change would be served the old
	// tier out of the browser's cache. Knowable before any CDN fetch, so a
	// conditional request is answered without touching the network at all.
	const tag = entityTag(stream.trackId ?? trackId, stream.audioQuality ?? 'auto');
	if (matchesEntityTag(event.request.headers.get('if-none-match'), tag)) {
		return new Response(null, { status: 304, headers: cacheHeaders(tag) });
	}

	// Segmented DASH (HiRes): no single URL to range against — concatenate every
	// fragment and serve the whole stream with Range support from an in-memory cache.
	if (stream.segmented) {
		try {
			const options = {
				key: `${stream.trackId}:${stream.audioQuality}`,
				urls: stream.urls,
				mimeType: stream.mimeType,
				// Global fetch, not `event.fetch` — see the note on the single-file path below.
				fetchImpl: fetch,
				rangeHeader: rangeIsUsable(event.request, tag) ? event.request.headers.get('range') : null,
				upstreamHeaders: CDN_HEADERS,
				responseHeaders: cacheHeaders(tag),
				signal: event.request.signal
			};
			return headOnly ? await headSegmentedAudio(options) : await streamSegmentedAudio(options);
		} catch (cause) {
			log.error('audio proxy: segmented fetch failed', { trackId, cause });
			error(502, 'CDN unreachable');
		}
	}

	const headers = new Headers(CDN_HEADERS);
	// Only forward the range when the client is not holding a stale partial.
	const range = rangeIsUsable(event.request, tag) ? event.request.headers.get('range') : null;
	if (range) headers.set('Range', range);

	let cdnHost = 'unknown';
	try {
		cdnHost = new URL(stream.streamUrl).host;
	} catch {
		/* keep the placeholder */
	}

	let upstream: Response;
	try {
		// Use the global fetch, NOT `event.fetch`: SvelteKit's wrapper forwards the
		// incoming request's context (cookies / referer) to the target, and the
		// TIDAL media CDN 403s a signed-URL request that carries those. Only the
		// query-string token authorises the request — send nothing else.
		upstream = await withTransientRetry(
			() =>
				fetch(stream.streamUrl, {
					method: headOnly ? 'HEAD' : 'GET',
					headers,
					redirect: 'follow',
					signal: event.request.signal
				}),
			{ signal: event.request.signal }
		);
	} catch (cause) {
		log.error('audio proxy: CDN fetch threw', { trackId, cdnHost, cause });
		error(502, 'CDN unreachable');
	}

	if (!upstream.ok && upstream.status !== 206) {
		log.error('audio proxy: CDN returned an error', {
			trackId,
			cdnHost,
			status: upstream.status
		});
		error(502, 'CDN unavailable');
	}

	const upstreamMimeType = upstream.headers.get('content-type');
	const responseHeaders = cacheHeaders(tag);
	responseHeaders.set(
		'Content-Type',
		upstreamMimeType?.toLowerCase().startsWith('audio/') ? upstreamMimeType : stream.mimeType
	);
	for (const name of ['content-length', 'content-range']) {
		const value = upstream.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}
	return new Response(headOnly ? null : upstream.body, {
		status: upstream.status,
		headers: responseHeaders
	});
}

export const GET: RequestHandler = (event) => serveAudio(event, false);

/**
 * Some clients probe a media URL with `HEAD` before committing to a fetch. Only
 * `GET` was exported, so those probes used to 404. This shares resolution and
 * response headers with GET but asks the CDN (or segmented manifest) for
 * metadata only; a HEAD must never begin a media-body transfer.
 */
export const HEAD: RequestHandler = (event) => serveAudio(event, true);
