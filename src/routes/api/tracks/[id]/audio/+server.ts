import { error, type RequestHandler } from '@sveltejs/kit';
import {
	getConnectionStatus,
	getRequestedStreamQuality,
	resolveTrackStream,
	TidalApiError,
	TidalAuthError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError
} from '#lib/server/tidal';

/**
 * Streams media through Syn so the browser never needs access to a TIDAL CDN URL.
 * Range forwarding preserves seeking in the native HTML audio player.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
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
		if (cause instanceof TidalQualityDeniedError) error(403, cause.message);
		if (
			cause instanceof TidalPlaybackNotLinkedError ||
			cause instanceof TidalAuthError ||
			(cause instanceof TidalApiError && (cause.status === 401 || cause.status === 403))
		) {
			error(403, 'Full playback is not linked. Authorize playback via TIDAL Link in settings.');
		}
		error(404, 'Stream unavailable');
	}

	const headers = new Headers({ Accept: '*/*', 'User-Agent': 'TIDAL_ANDROID/1039 okhttp/3.13.1' });
	const range = event.request.headers.get('range');
	if (range) headers.set('Range', range);
	const upstream = await event.fetch(stream.streamUrl, { headers });
	if (!upstream.ok && upstream.status !== 206) error(502, `CDN error: ${upstream.status}`);

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
