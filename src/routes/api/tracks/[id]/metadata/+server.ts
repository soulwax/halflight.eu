import { error, json, type RequestHandler } from '@sveltejs/kit';
import { tidalApi } from '#lib/server/tidal';
import { TidalApiError, TidalNotConnectedError } from '#lib/server/tidal/errors';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';
import { trackArtworkUrl } from '#lib/tidal/artwork';

/**
 * Resolve the display data for an already selected playback track. Session
 * restoration can encounter older, identifier-only snapshots; this gives the
 * player a small, safe live refresh without ever exposing a provider document
 * or media URL to the browser.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');

	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

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
		const artworkUrl =
			trackArtworkUrl({
				id: track.id,
				album: track.album ? { ...track.album, imageUrl: undefined } : undefined
			}) ?? `/api/tracks/${encodeURIComponent(track.id)}/artwork`;
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
	} catch (cause) {
		if (cause instanceof TidalNotConnectedError)
			return json({ error: 'not_connected' }, { status: 503 });
		// Old imported queues can contain recordings that TIDAL no longer exposes.
		// Surface that durable condition as a 404 so the client marks the entry as
		// unavailable instead of retrying it on every app-shell restore.
		if (cause instanceof TidalApiError && cause.status === 404) {
			return json({ error: 'not_found' }, { status: 404 });
		}
		return json({ error: 'metadata_unavailable' }, { status: 502 });
	}
};
