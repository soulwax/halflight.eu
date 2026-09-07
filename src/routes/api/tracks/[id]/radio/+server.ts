import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';

const MAX_TRACK_ID_LENGTH = 160;
const RADIO_INCLUDE = ['albums', 'artists'];

/**
 * Resolve a short, display-safe track radio set for an explicit player action.
 * Provider documents and credentials remain on the server; the browser only
 * receives the TrackSummary contract it needs to start a listening session.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');

	const trackId = event.params.id;
	if (!trackId || trackId.length > MAX_TRACK_ID_LENGTH) error(400, 'Track ID required');

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ tracks: [], error: 'not_connected' }, { status: 503 });
	}

	const ctx = { fetch: event.fetch, cookies: event.cookies };
	try {
		const document = await tidalApi
			.getTrackRelationship(trackId, 'radio', { include: RADIO_INCLUDE }, ctx)
			.catch(() =>
				tidalApi.getTrackRelationship(trackId, 'similarTracks', { include: RADIO_INCLUDE }, ctx)
			);
		const tracks = normaliseSearchResults(document).tracks.filter((track) => track.id !== trackId);

		return json({ tracks }, { headers: { 'cache-control': 'private, no-store' } });
	} catch {
		return json({ tracks: [], error: 'radio_unavailable' }, { status: 502 });
	}
};
