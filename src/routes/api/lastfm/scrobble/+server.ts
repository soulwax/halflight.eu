import { error, json, type RequestHandler } from '@sveltejs/kit';
import { LastfmError, scrobble, type LastfmTrackInput } from '#lib/server/lastfm';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	try {
		await scrobble(event.locals.user.id, (await event.request.json()) as LastfmTrackInput);
		return json({ ok: true });
	} catch (cause) {
		if (cause instanceof LastfmError) return json({ ok: false }, { status: 400 });
		return json({ ok: false }, { status: 502 });
	}
};
