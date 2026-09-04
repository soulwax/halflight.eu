import { redirect, type RequestHandler } from '@sveltejs/kit';
import { buildLastfmAuthorizeUrl, isLastfmConfigured } from '#lib/server/lastfm';
import { writeLastfmOAuthCookie } from '../oauth-cookie';

export const GET: RequestHandler = (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');
	if (!isLastfmConfigured()) redirect(303, '/app/settings/lastfm?error=unavailable');
	writeLastfmOAuthCookie(event.cookies, event.locals.user.id, event.url.protocol === 'https:');
	redirect(302, buildLastfmAuthorizeUrl(), { external: ['https://www.last.fm'] });
};
