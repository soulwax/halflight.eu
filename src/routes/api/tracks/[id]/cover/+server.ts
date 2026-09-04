import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';

/**
 * Resolve a track's artwork (and album reference) when the list it came from
 * didn't side-load it — search results and the resumed queue often arrive with
 * no `imageUrl`. Small, cacheable, no audio/token material.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

	const connection = await getConnectionStatus();
	if (!connection.connected) return json({ imageUrl: null, album: null }, { status: 200 });

	try {
		const document = await tidalApi.getTrack(
			trackId,
			{ include: ['albums', 'artists'] },
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const track = normaliseTrackDetail(document);
		return json(
			{ imageUrl: track?.imageUrl ?? null, album: track?.album ?? null },
			{ headers: { 'cache-control': 'private, max-age=3600' } }
		);
	} catch {
		return json({ imageUrl: null, album: null }, { status: 200 });
	}
};
