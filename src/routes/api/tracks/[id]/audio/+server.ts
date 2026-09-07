import { error, type RequestHandler } from '@sveltejs/kit';
import {
	getConnectionStatus,
	getRequestedStreamQuality,
	isTrackUnavailableForPlayback,
	resolveTrackStream,
	streamSegmentedAudio,
	TidalApiError,
	TidalAuthError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError
} from '#lib/server/tidal';
import { log } from '#lib/server/log';

/** CDN-facing headers borrowed from the TIDAL Android client. */
const CDN_HEADERS = { Accept: '*/*', 'User-Agent': 'TIDAL_ANDROID/1039 okhttp/3.13.1' };

/**
 * Streams media through Syn so the browser never needs access to a TIDAL CDN URL.
 * Range forwarding preserves seeking in the native HTML audio player.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

	const status = await getConnectionStatus();
	if (!status.configured) error(503, 'TIDAL not connected');
	if (!status.hasPlayback)
		error(403, 'Full playback is not linked. Authorize playback via TIDAL Link in settings.');

	let stream;
	try {
		stream = await resolveTrackStream(trackId, {
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

	// Segmented DASH (HiRes): no single URL to range against — concatenate every
	// fragment and serve the whole stream with Range support from an in-memory cache.
	if (stream.segmented) {
		try {
			return await streamSegmentedAudio({
				key: `${stream.trackId}:${stream.audioQuality}`,
				urls: stream.urls,
				mimeType: stream.mimeType,
				// Global fetch, not `event.fetch` — see the note on the single-file path below.
				fetchImpl: fetch,
				rangeHeader: event.request.headers.get('range'),
				upstreamHeaders: CDN_HEADERS
			});
		} catch (cause) {
			log.error('audio proxy: segmented fetch failed', { trackId, cause });
			error(502, 'CDN unreachable');
		}
	}

	const headers = new Headers(CDN_HEADERS);
	const range = event.request.headers.get('range');
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
		upstream = await fetch(stream.streamUrl, { headers, redirect: 'follow' });
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
	const responseHeaders = new Headers({
		'Content-Type': upstreamMimeType?.toLowerCase().startsWith('audio/')
			? upstreamMimeType
			: stream.mimeType,
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
		Vary: 'Range'
	});
	for (const name of ['content-length', 'content-range']) {
		const value = upstream.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}
	return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
};
