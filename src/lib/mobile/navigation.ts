import { isMobileRoute, isPublicMobileRoute } from './routes';
import { deLocalizeUrl } from '#lib/paraglide/runtime';

export const MOBILE_PLAYER_NAVIGATION = Symbol('mobile-player-navigation');
export interface MobilePlayerNavigation {
	returnTo: string;
}

export const MOBILE_DETAIL_NAVIGATION = Symbol('mobile-detail-navigation');
export interface MobileDetailNavigation {
	returnTargets: Map<string, string>;
}

/** Keep a detail's parent when returning through nested artist/album/track pages. */
export function rememberMobileDetailReturn(
	{ from, to, shallow }: MobileNavigation,
	returnTargets: Map<string, string>
): void {
	if (
		shallow ||
		!from ||
		!to ||
		from.origin !== to.origin ||
		from.pathname === to.pathname ||
		!isMobileRoute(from.pathname) ||
		isPublicMobileRoute(from.pathname) ||
		!/^\/(albums|playlists|artists|tracks)\/[^/]+\/?$/.test(deLocalizeUrl(to.pathname).pathname)
	)
		return;
	const source = mobileScrollKey(from);
	const destination = mobileScrollKey(to);
	const visited = new Set<string>();
	for (let parent: string | undefined = source; parent && !visited.has(parent);) {
		// Returning to any ancestor must not make it point back at its child.
		if (parent === destination) return;
		visited.add(parent);
		parent = returnTargets.get(parent);
	}
	returnTargets.set(destination, source);
}

export function isNowRoute(pathname: string): boolean {
	const path = deLocalizeUrl(pathname).pathname;
	return path === '/now' || path.startsWith('/now/');
}

/** Remember only the actual same-origin scene that opened Now, never an external Back target. */
export function mobilePlayerReturnTarget(from: URL | null, to: URL | null): string | null {
	if (
		!from ||
		!to ||
		from.origin !== to.origin ||
		!isNowRoute(to.pathname) ||
		!isMobileRoute(from.pathname) ||
		isNowRoute(from.pathname) ||
		isPublicMobileRoute(from.pathname)
	)
		return null;
	return `${from.pathname}${from.search}`;
}

/**
 * A location's scroll state belongs to its page path and URL-backed controls.
 * Fragments deliberately stay out of the key so native anchor navigation keeps
 * its expected target behaviour.
 */
export function mobileScrollKey(url: Pick<URL, 'pathname' | 'search'>): string {
	return `${url.pathname}${url.search}`;
}

export interface MobileNavigation {
	from: URL | null;
	to: URL | null;
	shallow: boolean;
}

/**
 * Halflight Now owns the scroll position of its single main region. A shallow
 * URL update belongs to the active scene and must leave its scroll untouched.
 */
export function managesMobileScroll(navigation: MobileNavigation): boolean {
	return Boolean(
		!navigation.shallow &&
		navigation.from &&
		navigation.to &&
		isMobileRoute(navigation.from.pathname) &&
		isMobileRoute(navigation.to.pathname) &&
		mobileScrollKey(navigation.from) !== mobileScrollKey(navigation.to)
	);
}

/**
 * Moving between scenes should announce the destination. Search/filter URL
 * updates intentionally retain input focus, even when they are not shallow.
 */
export function shouldFocusMobileDestination(navigation: MobileNavigation): boolean {
	return Boolean(
		managesMobileScroll(navigation) &&
		navigation.from &&
		navigation.to &&
		navigation.from.pathname !== navigation.to.pathname
	);
}
