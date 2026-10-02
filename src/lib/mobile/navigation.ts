import { isMobileRoute, isPublicMobileRoute } from './routes';
import { deLocalizeUrl } from '#lib/paraglide/runtime';

export const MOBILE_PLAYER_NAVIGATION = Symbol('mobile-player-navigation');
export interface MobilePlayerNavigation {
	returnTo: string;
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
export function mobileScrollKey(url: URL): string {
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
