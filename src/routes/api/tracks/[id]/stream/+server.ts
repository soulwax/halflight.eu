import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	fetchTrackStream,
	getConnectionStatus,
	TidalApiError,
	type TrackAudioQuality
} from '#lib/server/tidal';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ error: 'not_connected' }, { status: 503 });
	}

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	const requestedQuality = (event.url.searchParams.get('quality')?.toUpperCase() ||
		'HIGH') as TrackAudioQuality;
	const qualityTiers: TrackAudioQuality[] = Array.from(
		new Set([requestedQuality, 'HIGH', 'LOW', 'LOSSLESS'])
	);

	let lastError: unknown = null;

	for (const quality of qualityTiers) {
		try {
			const streamInfo = await fetchTrackStream(trackId, {
				quality,
				ctx: {
					fetch: event.fetch,
					cookies: event.cookies
				}
			});

			return json(streamInfo);
		} catch (err) {
			lastError = err;
			// If it's a 401 or 403 (scope missing or subscription issue), trying other qualities won't change the token status
			if (err instanceof TidalApiError && (err.status === 401 || err.status === 403)) {
				break;
			}
		}
	}

	if (
		lastError instanceof TidalApiError &&
		(lastError.status === 401 || lastError.status === 403)
	) {
		return json(
			{
				error: 'playback_unauthorized',
				message: lastError.message,
				requiresFullAuth: true
			},
			{ status: 403 }
		);
	}

	return json({ error: 'stream_unavailable' }, { status: 404 });
};
