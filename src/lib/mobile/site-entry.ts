import { deLocalizeUrl } from '#lib/paraglide/runtime';
import { isMobileRoute } from './routes';

export type SiteChoice = 'mobile' | 'desktop';
export const SITE_CHOICE_COOKIE = 'hf-site';

/** Authentication callbacks only accept product destinations on this origin. */
export function safeProductReturn(value: unknown): string | null {
	if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
	if (value.includes('\\') || Array.from(value).some((character) => character.charCodeAt(0) < 32))
		return null;
	try {
		const url = new URL(value, 'https://halflight.invalid');
		if (url.origin !== 'https://halflight.invalid') return null;
		const path = deLocalizeUrl(url).pathname;
		if (path === '/' || path === '/app' || path.startsWith('/app/') || isMobileRoute(path))
			return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		// Invalid percent encoding or malformed URL.
	}
	return null;
}

export function readSiteChoice(cookieHeader: string): SiteChoice | null {
	const value = cookieHeader
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${SITE_CHOICE_COOKIE}=`))
		?.split('=')[1];
	return value === 'mobile' || value === 'desktop' ? value : null;
}

export function chooseSite(cookieHeader: string, viewportWidth: number): SiteChoice {
	return readSiteChoice(cookieHeader) ?? (viewportWidth <= 768 ? 'mobile' : 'desktop');
}

export function rememberSiteChoice(site: SiteChoice): void {
	document.cookie = `${SITE_CHOICE_COOKIE}=${site}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

/** Match the same music destination across the two independent shells. */
export function switchSitePath(pathname: string, site: SiteChoice): string {
	const path = deLocalizeUrl(new URL(pathname, 'https://halflight.invalid')).pathname;
	const suffix = path.startsWith('/app/') ? path.slice(4) : path;
	const paired =
		/^(?:\/(?:albums|artists|playlists|tracks)\/[^/]+|\/(?:search|library|generate))\/?$/.test(
			suffix
		);
	if (site === 'mobile') return paired ? suffix : '/home';
	return paired ? `/app${suffix}` : '/app';
}
