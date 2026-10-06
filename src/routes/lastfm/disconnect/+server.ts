import { redirect, type RequestHandler } from '@sveltejs/kit';
import { disconnectLastfm } from '#lib/server/lastfm';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) redirect(302, '/sign-in');
	await disconnectLastfm(event.locals.user.id);
	redirect(303, '/app/settings/lastfm?disconnected=1');
};
