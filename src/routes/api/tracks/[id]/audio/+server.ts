import { error, type RequestHandler } from '@sveltejs/kit';
import {
	fetchTrackStream,
	getConnectionStatus,
	TidalApiError,
	type TrackAudioQuality
} from '#lib/server/tidal';

/**
 * GET /api/tracks/[id]/audio
 *
 * Proxies the TIDAL audio stream through the SvelteKit server so that the
 * browser `<audio>` element is not blocked by CORS restrictions on the TIDAL
 * CDN. Supports HTTP Range requests so seeking works.
 *
 * This is the key fix: TIDAL CDN URLs do not allow browser cross-origin
 * requests, but server-to-server fetches succeed. We pipe the response body
 * back to the client with the correct Content-Type and Accept-Ranges headers.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		error(503, 'TIDAL not connected');
	}

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	const requestedQuality = (event.url.searchParams.get('quality')?.toUpperCase() ||
		'HIGH') as TrackAudioQuality;

	// Try qualities in order from best available to lowest
	const qualityTiers: TrackAudioQuality[] = Array.from(new Set([requestedQuality, 'HIGH', 'LOW']));

	let streamInfo: Awaited<ReturnType<typeof fetchTrackStream>> | null = null;
	let lastError: unknown = null;

	for (const quality of qualityTiers) {
		try {
			streamInfo = await fetchTrackStream(trackId, {
				quality,
				ctx: { fetch: event.fetch, cookies: event.cookies }
			});
			break;
		} catch (err) {
			lastError = err;
			if (err instanceof TidalApiError && (err.status === 401 || err.status === 403)) {
				break;
			}
		}
	}

	if (!streamInfo) {
		if (
			lastError instanceof TidalApiError &&
			(lastError.status === 401 || lastError.status === 403)
		) {
			error(403, 'Playback scope missing – reconnect with r_usr scope via Device Auth');
		}
		error(404, 'Stream unavailable');
	}

	// streamUrl is the first URL in the manifest (works for BTS single-file manifests)
	const audioUrl = streamInfo.streamUrl;

	// Fetch the audio from TIDAL CDN server-side, forwarding Range header if present
	const upstreamHeaders: Record<string, string> = {
		Accept: '*/*',
		'User-Agent': 'TIDAL_ANDROID/1039 okhttp/3.13.1'
	};

	const rangeHeader = event.request.headers.get('range');
	if (rangeHeader) {
		upstreamHeaders['Range'] = rangeHeader;
	}

	const upstreamRes = await event.fetch(audioUrl, { headers: upstreamHeaders });

	if (!upstreamRes.ok && upstreamRes.status !== 206) {
		error(502, `CDN error: ${upstreamRes.status}`);
	}

	// Build passthrough response with correct audio headers
	const responseHeaders = new Headers();
	responseHeaders.set('Content-Type', streamInfo.mimeType || 'audio/mp4');
	responseHeaders.set('Accept-Ranges', 'bytes');
	responseHeaders.set('Cache-Control', 'no-store');

	// Forward content headers from CDN
	for (const h of ['content-length', 'content-range', 'content-type']) {
		const val = upstreamRes.headers.get(h);
		if (val) responseHeaders.set(h, val);
	}

	// Always set the correct mime type from our manifest
	responseHeaders.set('Content-Type', streamInfo.mimeType || 'audio/mp4');

	return new Response(upstreamRes.body, {
		status: upstreamRes.status,
		headers: responseHeaders
	});
};
