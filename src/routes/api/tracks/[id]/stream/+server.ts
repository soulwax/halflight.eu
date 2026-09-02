import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	fetchTrackStream,
	getConnectionStatus,
	TidalApiError,
	TidalAuthError,
	TidalPlaybackNotLinkedError,
	type TrackAudioQuality
} from '#lib/server/tidal';

function isAuthProblem(err: unknown): boolean {
	return (
		err instanceof TidalPlaybackNotLinkedError ||
		err instanceof TidalAuthError ||
		(err instanceof TidalApiError && (err.status === 401 || err.status === 403))
	);
}

/** A short, loggable reason for a playback failure. */
function describe(err: unknown): string {
	if (err instanceof TidalPlaybackNotLinkedError) return 'not_linked';
	if (err instanceof TidalAuthError) return 'device_refresh_rejected';
	if (err instanceof TidalApiError) {
		const body = err.body as { subStatus?: number; userMessage?: string } | null;
		return `tidal_${err.status}${body?.subStatus ? `_${body.subStatus}` : ''}: ${
			body?.userMessage ?? err.statusText
		}`;
	}
	return err instanceof Error ? err.message : 'unknown';
}

/**
 * GET /api/tracks/[id]/stream
 *
 * Returns full playback metadata (stream URL, quality, codecs, ReplayGain) for a
 * track. Full playback needs the TIDAL Link (device) token; when it is missing
 * or rejected the response is a 403 with `requiresFullAuth: true` so the player
 * can prompt the user to link.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const status = await getConnectionStatus();
	if (!status.configured) {
		return json({ error: 'not_connected' }, { status: 503 });
	}
	if (!status.hasPlayback) {
		return json(
			{
				error: 'playback_unauthorized',
				message: 'Full playback is not linked. Authorize playback via TIDAL Link in settings.',
				requiresFullAuth: true
			},
			{ status: 403 }
		);
	}

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	const requestedQuality = (event.url.searchParams.get('quality')?.toUpperCase() ||
		'HIGH') as TrackAudioQuality;
	const qualityTiers: TrackAudioQuality[] = Array.from(
		new Set<TrackAudioQuality>([requestedQuality, 'LOSSLESS', 'HIGH', 'LOW'])
	);

	const ctx = { fetch: event.fetch, cookies: event.cookies };
	let lastError: unknown = null;

	for (const quality of qualityTiers) {
		try {
			const streamInfo = await fetchTrackStream(trackId, { quality, ctx });
			return json({ ...streamInfo, isPreview: false, requiresFullAuth: false });
		} catch (err) {
			lastError = err;
			if (isAuthProblem(err)) break;
		}
	}

	const reason = describe(lastError);
	console.error(`[tidal] stream ${trackId} failed: ${reason}`);

	if (isAuthProblem(lastError)) {
		return json(
			{
				error: 'playback_unauthorized',
				reason,
				message:
					lastError instanceof Error ? lastError.message : 'Full playback authorization required.',
				requiresFullAuth: true
			},
			{ status: 403 }
		);
	}

	return json({ error: 'stream_unavailable', reason }, { status: 404 });
};
