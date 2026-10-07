import type { Cookies } from '@sveltejs/kit';

/**
 * TIDAL tokens once lived in this encrypted cookie; they are now stored per user
 * in Postgres only. Disconnect still deletes it so no old browser keeps a copy.
 */
export const TIDAL_TOKEN_COOKIE = 'tidal_token';

export function clearTokenCookie(cookies: Cookies): void {
	cookies.delete(TIDAL_TOKEN_COOKIE, { path: '/app' });
}
