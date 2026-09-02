import { redirect } from '@sveltejs/kit';
import { clearRecord, clearTokenCookie } from '#lib/server/tidal';
import { clearOAuthCookie } from '../oauth-cookie';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) redirect(302, '/sign-in');

	// TIDAL exposes no token-revocation endpoint, so disconnecting is a local
	// wipe: remove the encrypted record and any in-flight OAuth cookie.
	await clearRecord();
	clearTokenCookie(event.cookies);
	clearOAuthCookie(event.cookies);

	redirect(303, '/app/settings/tidal?disconnected=1');
};
