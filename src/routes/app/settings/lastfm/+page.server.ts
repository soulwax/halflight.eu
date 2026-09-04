import { redirect } from '@sveltejs/kit';
import { getLastfmConnection } from '#lib/server/lastfm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');
	return {
		connection: await getLastfmConnection(event.locals.user.id),
		notice: {
			connected: event.url.searchParams.has('connected'),
			disconnected: event.url.searchParams.has('disconnected'),
			error: event.url.searchParams.get('error')
		}
	};
};
