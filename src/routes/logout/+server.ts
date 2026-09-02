import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth';
import { purgeCookies } from '#lib/server/logout';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		await auth.api.signOut({ headers: event.request.headers });
	} finally {
		purgeCookies(event.cookies);
		event.setHeaders({ 'clear-site-data': '"cookies"' });
	}

	redirect(303, '/sign-in');
};
