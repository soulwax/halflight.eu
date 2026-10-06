import { deLocalizeUrl } from '#lib/paraglide/runtime';

/**
 * Single source of truth for "is this URL part of Halflight Now (the mobile
 * site)". The mobile site currently lives inside this same SvelteKit app as a
 * `(mobile)` route group under these root-level paths, sharing a server and
 * database with the desktop Listening Room but none of its shell components.
 *
 * Nothing outside this module should hard-code a mobile path prefix.
 */
export const MOBILE_ROOT_PATHS = [
	'/now',
	'/home',
	'/search',
	'/library',
	'/generate',
	'/settings',
	'/offline',
	'/albums',
	'/playlists',
	'/artists',
	'/tracks'
] as const;

/**
 * Public mobile routes intentionally avoid the authenticated Halflight shell.
 * They can be precached without carrying a listening session or account data.
 */
export const PUBLIC_MOBILE_ROOT_PATHS = ['/offline'] as const;

export function isMobileRoute(pathname: string): boolean {
	const deLocalizedPathname = deLocalizeUrl(pathname).pathname;
	return MOBILE_ROOT_PATHS.some(
		(path) => deLocalizedPathname === path || deLocalizedPathname.startsWith(`${path}/`)
	);
}

export function isPublicMobileRoute(pathname: string): boolean {
	const deLocalizedPathname = deLocalizeUrl(pathname).pathname;
	return PUBLIC_MOBILE_ROOT_PATHS.some(
		(path) => deLocalizedPathname === path || deLocalizedPathname.startsWith(`${path}/`)
	);
}

/**
 * Where an error page sends the listener. A failure on a Halflight Now URL must
 * stay on the mobile site rather than dropping a phone into the desktop
 * Listening Room.
 */
export function errorRecoveryPath(pathname: string): '/home' | '/app' {
	return isMobileRoute(pathname) && !isPublicMobileRoute(pathname) ? '/home' : '/app';
}
