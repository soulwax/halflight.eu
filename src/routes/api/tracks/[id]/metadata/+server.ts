import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';

/**
 * Resolve the display data for an already selected playback track. Session
 * restoration can encounter older, identifier-only snapshots; this gives the
 * player a small, safe live refresh without ever exposing a provider document
 * or media URL to the browser.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');

	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');
	if (!(await getConnectionStatus()).connected) {
		return json({ error: 'not_connected' }, { status: 503 });
	}

	try {
		const document = await tidalApi.getTrack(
			trackId,
			{ include: ['artists', 'albums'] },
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const track = normaliseTrackDetail(document);
		if (!track) return json({ error: 'not_found' }, { status: 404 });

		// Keep provider artwork addresses server-side. The player can still use its
		// existing same-origin artwork proxy and handles a missing cover gracefully.
		const artworkUrl = `/api/tracks/${encodeURIComponent(track.id)}/artwork`;
		return json(
			{
				track: {
					...track,
					imageUrl: artworkUrl,
					...(track.album ? { album: { ...track.album, imageUrl: artworkUrl } } : {})
				}
			},
			{ headers: { 'cache-control': 'private, no-store' } }
		);
	} catch {
		return json({ error: 'metadata_unavailable' }, { status: 502 });
	}
};
