import { redirect, type RequestHandler } from '@sveltejs/kit';
import { exchangeLastfmToken, LastfmError } from '#lib/server/lastfm';
import { clearLastfmOAuthCookie, readLastfmOAuthCookie } from '../oauth-cookie';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');
	const linkedUserId = readLastfmOAuthCookie(event.cookies);
	clearLastfmOAuthCookie(event.cookies);
	if (linkedUserId !== event.locals.user.id) {
		redirect(303, '/app/settings/lastfm?error=account_mismatch');
	}
	const token = event.url.searchParams.get('token');
	if (!token) redirect(303, '/app/settings/lastfm?error=missing_token');
	try {
		await exchangeLastfmToken(event.locals.user.id, token);
	} catch (error) {
		if (error instanceof LastfmError)
			redirect(303, '/app/settings/lastfm?error=authorization_failed');
		throw error;
	}
	redirect(303, '/app/settings/lastfm?connected=1');
};
