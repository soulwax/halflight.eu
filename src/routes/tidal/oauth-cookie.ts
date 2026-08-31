import type { Cookies } from '@sveltejs/kit';

/** Short-lived cookie holding `{ state, verifier }` during the OAuth round-trip. */
export const OAUTH_COOKIE = 'tidal_oauth';

export function oauthCookieOptions(url: URL) {
	return {
		path: '/tidal',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: 600
	};
}

export interface OAuthCookiePayload {
	state: string;
	verifier: string;
}

export function readOAuthCookie(cookies: Cookies): OAuthCookiePayload | null {
	const raw = cookies.get(OAUTH_COOKIE);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as OAuthCookiePayload;
		if (typeof parsed.state === 'string' && typeof parsed.verifier === 'string') return parsed;
	} catch {
		/* fall through */
	}
	return null;
}

export function clearOAuthCookie(cookies: Cookies): void {
	cookies.delete(OAUTH_COOKIE, { path: '/tidal' });
}
