import { error, json, type RequestHandler } from '@sveltejs/kit';
import { fetchAlbumCredits, getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseTrack } from '#lib/server/tidal/normalise';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');
	if (!(await getConnectionStatus()).connected)
		return json({ error: 'not_connected' }, { status: 503 });
	try {
		const document = await tidalApi.getTrack(
			trackId,
			{ include: ['albums'] },
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const included = new Map(
			(document.included ?? []).map((item) => [`${item.type}:${item.id}`, item])
		);
		const track = normaliseTrack(document.data, included);
		if (!track?.album?.id) return json({ credits: [] });
		const items = await fetchAlbumCredits(track.album.id, {
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
		return json({
			credits: items.find((item) => String(item.item.id) === track.id)?.credits ?? []
		});
	} catch {
		return json({ error: 'credits_unavailable' }, { status: 502 });
	}
};
