import type { Cookies } from '@sveltejs/kit';

const COOKIE_PATHS = ['/', '/api/auth', '/tidal'];
const TIDAL_OAUTH_COOKIE = 'tidal_oauth';

/** Remove all application cookies and every cookie scoped to a known Syn path. */
export function purgeCookies(cookies: Cookies): void {
	const cookieNames = new Set([
		...cookies.getAll().map((cookie) => cookie.name),
		TIDAL_OAUTH_COOKIE
	]);

	for (const name of cookieNames) {
		for (const path of COOKIE_PATHS) cookies.delete(name, { path });
	}
}
