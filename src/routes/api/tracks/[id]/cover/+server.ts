import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus, getTrackCoverId } from '#lib/server/tidal';

/**
 * Resolve a player-safe, same-origin artwork URL when the list it came from
 * carries no cover. TIDAL v2 omits cover identifiers, so this uses the legacy
 * playback metadata endpoint without returning its CDN URL to the browser.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

	const connection = await getConnectionStatus();
	if (!connection.connected) return json({ imageUrl: null, album: null }, { status: 200 });

	try {
		const coverId = await getTrackCoverId(trackId, {
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
		return json(
			{
				imageUrl: coverId ? `/api/tracks/${encodeURIComponent(trackId)}/artwork` : null,
				album: null
			},
			{ headers: { 'cache-control': 'private, max-age=3600' } }
		);
	} catch {
		return json({ imageUrl: null, album: null }, { status: 200 });
	}
};
