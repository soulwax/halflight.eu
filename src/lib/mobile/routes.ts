/**
 * Single source of truth for "is this URL part of Halflight Now (the mobile
 * site)". The mobile site currently lives inside this same SvelteKit app as a
 * `(mobile)` route group under these root-level paths, sharing a server and
 * database with the desktop Listening Room but none of its shell components.
 *
 * Grows as more mobile routes ship (search, library, settings); nothing
 * outside this module should hard-code a mobile path prefix.
 */
export const MOBILE_ROOT_PATHS = [
	'/now',
	'/home',
	'/search',
	'/library',
	'/settings',
	'/offline'
] as const;

/**
 * Public mobile routes intentionally avoid the authenticated Halflight shell.
 * They can be precached without carrying a listening session or account data.
 */
export const PUBLIC_MOBILE_ROOT_PATHS = ['/offline'] as const;

export function isMobileRoute(pathname: string): boolean {
	return MOBILE_ROOT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isPublicMobileRoute(pathname: string): boolean {
	return PUBLIC_MOBILE_ROOT_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`)
	);
}
