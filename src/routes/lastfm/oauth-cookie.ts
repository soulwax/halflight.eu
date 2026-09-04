import type { Cookies } from '@sveltejs/kit';

const LASTFM_OAUTH_COOKIE = 'lastfm_oauth';

export function writeLastfmOAuthCookie(cookies: Cookies, userId: string, secure: boolean): void {
	cookies.set(LASTFM_OAUTH_COOKIE, userId, {
		path: '/lastfm',
		httpOnly: true,
		secure,
		sameSite: 'lax',
		maxAge: 10 * 60
	});
}

export function readLastfmOAuthCookie(cookies: Cookies): string | null {
	return cookies.get(LASTFM_OAUTH_COOKIE) ?? null;
}

export function clearLastfmOAuthCookie(cookies: Cookies): void {
	cookies.delete(LASTFM_OAUTH_COOKIE, { path: '/lastfm' });
}
