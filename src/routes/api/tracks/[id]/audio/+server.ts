import { error, type RequestHandler } from '@sveltejs/kit';
import {
	getConnectionStatus,
	resolveTrackStream,
	TidalApiError,
	TidalAuthError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError,
	type TrackAudioQuality
} from '#lib/server/tidal';
import { getStreamingSettings, isStreamingQuality } from '#lib/server/streaming-settings';

async function startQuality(event: {
	url: URL;
	locals: App.Locals;
}): Promise<TrackAudioQuality | undefined> {
	const explicit = event.url.searchParams.get('quality')?.toUpperCase();
	if (explicit && isStreamingQuality(explicit)) return explicit;
	if (!event.locals.user) return undefined;
	try {
		return (await getStreamingSettings(event.locals.user.id)).preferredQuality;
	} catch {
		return undefined;
	}
}

/**
 * GET /api/tracks/[id]/audio
 *
 * Proxies the TIDAL audio stream through the server so the browser `<audio>`
 * element is not blocked by CORS on the TIDAL CDN. Forwards Range requests so
 * seeking works. Walks down the quality ladder to whatever the plan allows.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const status = await getConnectionStatus();
	if (!status.configured) {
		error(503, 'TIDAL not connected');
	}
	if (!status.hasPlayback) {
		error(403, 'Full playback is not linked. Authorize playback via TIDAL Link in settings.');
	}

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	let streamInfo: Awaited<ReturnType<typeof resolveTrackStream>>;
	try {
		streamInfo = await resolveTrackStream(trackId, {
			quality: await startQuality(event),
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
	} catch (err) {
		if (err instanceof TidalQualityDeniedError) {
			error(403, err.message);
		}
		if (
			err instanceof TidalPlaybackNotLinkedError ||
			err instanceof TidalAuthError ||
			(err instanceof TidalApiError && (err.status === 401 || err.status === 403))
		) {
			error(403, 'Full playback is not linked. Authorize playback via TIDAL Link in settings.');
		}
		error(404, 'Stream unavailable');
	}

	const audioUrl = streamInfo.streamUrl;

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

	const responseHeaders = new Headers();
	responseHeaders.set('Content-Type', streamInfo.mimeType || 'audio/mp4');
	responseHeaders.set('Accept-Ranges', 'bytes');
	responseHeaders.set('Cache-Control', 'no-store');
	for (const h of ['content-length', 'content-range']) {
		const val = upstreamRes.headers.get(h);
		if (val) responseHeaders.set(h, val);
	}

	return new Response(upstreamRes.body, {
		status: upstreamRes.status,
		headers: responseHeaders
	});
};
