import { error, json, type RequestHandler } from '@sveltejs/kit';
import { fetchTrackLyrics, getConnectionStatus } from '#lib/server/tidal';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
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

	try {
		const lyricsData = await fetchTrackLyrics(trackId, {
			ctx: {
				fetch: event.fetch,
				cookies: event.cookies
			}
		});

		return json(lyricsData);
	} catch {
		return json({ error: 'lyrics_unavailable' }, { status: 404 });
	}
};
