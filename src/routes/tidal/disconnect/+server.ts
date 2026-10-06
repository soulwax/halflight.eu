import { redirect } from '@sveltejs/kit';
import {
	clearPlaybackRecord,
	clearRecord,
	clearTokenCookie,
	invalidateStreamCache
} from '#lib/server/tidal';
import { clearOAuthCookie, tidalReturnTo } from '../oauth-cookie';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) redirect(302, '/sign-in');

	// TIDAL exposes no token-revocation endpoint, so disconnecting is a local
	// wipe: remove both encrypted tokens, any in-flight cookies, and every
	// memoised manifest — those hold CDN URLs signed for the session being ended.
	await Promise.all([clearRecord(), clearPlaybackRecord(), invalidateStreamCache()]);
	clearTokenCookie(event.cookies);
	clearOAuthCookie(event.cookies);

	redirect(303, `${tidalReturnTo(event.url.searchParams.get('returnTo'))}?disconnected=1`);
};
