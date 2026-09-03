import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	describePlaybackDelivery,
	getConnectionStatus,
	getRequestedStreamQuality,
	resolveTrackStream,
	TidalApiError,
	TidalAuthError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError
} from '#lib/server/tidal';

function isAuthProblem(cause: unknown): boolean {
	return (
		cause instanceof TidalPlaybackNotLinkedError ||
		cause instanceof TidalAuthError ||
		(cause instanceof TidalApiError && (cause.status === 401 || cause.status === 403))
	);
}

/** Server-resolved stream metadata. Audio bytes are available through the matching `/audio` route. */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

	const status = await getConnectionStatus();
	if (!status.configured) return json({ error: 'not_connected' }, { status: 503 });
	if (!status.hasPlayback) {
		return json(
			{
				error: 'playback_unauthorized',
				reason: 'not_linked',
				message: 'Full playback is not linked. Authorize playback via TIDAL Link in settings.',
				requiresFullAuth: true
			},
			{ status: 403 }
		);
	}

	try {
		const requestedQuality = await getRequestedStreamQuality(event.url, event.locals.user.id);
		const stream = await resolveTrackStream(trackId, {
			quality: requestedQuality,
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
		// CDN URLs are short-lived bearer-like capabilities. They are needed only by
		// the matching server-side audio proxy and must never cross this boundary.
		return json({
			trackId: stream.trackId,
			fileExtension: stream.fileExtension,
			mimeType: stream.mimeType,
			codecs: stream.codecs,
			audioMode: stream.audioMode,
			audioQuality: stream.audioQuality,
			requestedQuality: requestedQuality ?? null,
			bitDepth: stream.bitDepth,
			sampleRate: stream.sampleRate,
			trackReplayGain: stream.trackReplayGain,
			delivery: describePlaybackDelivery(stream),
			isPreview: false,
			requiresFullAuth: false
		});
	} catch (cause) {
		if (cause instanceof TidalQualityDeniedError) {
			return json(
				{ error: 'plan_no_streaming', message: cause.message, requiresFullAuth: false },
				{ status: 403 }
			);
		}
		if (isAuthProblem(cause)) {
			return json(
				{
					error: 'playback_unauthorized',
					message: cause instanceof Error ? cause.message : 'Full playback authorization required.',
					requiresFullAuth: true
				},
				{ status: 403 }
			);
		}
		return json({ error: 'stream_unavailable', requiresFullAuth: false }, { status: 404 });
	}
};
