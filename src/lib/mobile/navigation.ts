import { isMobileRoute } from './routes';

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
