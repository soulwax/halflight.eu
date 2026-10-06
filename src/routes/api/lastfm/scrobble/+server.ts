import { error, json, type RequestHandler } from '@sveltejs/kit';
import { LastfmError, scrobble, type LastfmTrackInput } from '#lib/server/lastfm';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	try {
		const result = await scrobble(
			event.locals.user.id,
			(await event.request.json()) as LastfmTrackInput
		);
		return json({ ok: true, ...result });
	} catch (cause) {
		if (cause instanceof LastfmError) {
			const temporaryProviderFailure = [11, 16, 29].includes(cause.code ?? -1);
			return json({ ok: false }, { status: temporaryProviderFailure ? 503 : 400 });
		}
		return json({ ok: false }, { status: 502 });
	}
};
