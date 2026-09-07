import { error, json, type RequestHandler } from '@sveltejs/kit';
import { reportNowPlaying, type LastfmTrackInput } from '#lib/server/lastfm';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	try {
		await reportNowPlaying(event.locals.user.id, (await event.request.json()) as LastfmTrackInput);
	} catch {
		// Now-playing is ephemeral and intentionally never blocks playback.
	}
	return json({ ok: true });
};
