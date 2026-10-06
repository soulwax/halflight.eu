import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	fetchTrackLyrics,
	getConnectionStatus,
	resolveLyricsFallbacks,
	type ParsedTrackLyrics
} from '#lib/server/tidal';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) {
		error(401, 'Unauthorized');
	}

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	const title = event.url?.searchParams?.get('title') || undefined;
	const artist = event.url?.searchParams?.get('artist') || undefined;
	const album = event.url?.searchParams?.get('album') || undefined;
	const durationParam = event.url?.searchParams?.get('duration');
	const duration = durationParam ? Number(durationParam) : undefined;

	const connection = await getConnectionStatus();
	// If not connected and no title/artist hints are provided for fallbacks,
	// return 503 as TIDAL is required to even know what track this is.
	if (!connection.connected && !title && !artist) {
		return json({ error: 'not_connected' }, { status: 503 });
	}

	let lyricsData: ParsedTrackLyrics | null = null;

	// Tier 1: Try primary TIDAL lyrics if connected and track is numeric
	if (connection.connected && /^\d+$/.test(trackId)) {
		try {
			lyricsData = await fetchTrackLyrics(trackId, {
				ctx: {
					fetch: event.fetch,
					cookies: event.cookies
				}
			});
		} catch {
			lyricsData = null;
		}
	}

	// Tier 2+: If TIDAL did not yield lyrics, utilize fallbacks (LRCLIB, Lyrics.ovh)
	if (!lyricsData || (!lyricsData.lyrics?.trim() && !lyricsData.cues?.length)) {
		lyricsData = await resolveLyricsFallbacks(trackId, {
			ctx: {
				fetch: event.fetch,
				cookies: event.cookies
			},
			title,
			artist,
			album,
			duration
		});
	}

	if (lyricsData && (lyricsData.lyrics?.trim().length > 0 || lyricsData.cues?.length > 0)) {
		return json(lyricsData);
	}

	return json({ error: 'lyrics_unavailable' }, { status: 404 });
};
