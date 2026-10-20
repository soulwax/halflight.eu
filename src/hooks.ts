import type { Reroute } from '@sveltejs/kit/hooks';
import { deLocalizeUrl } from '#lib/paraglide/runtime';

export const reroute: Reroute = (request) => {
	const pathname = request.url.pathname;
	if (pathname === '/de-de/offline' || pathname === '/de-de/offline/') return pathname;
	return deLocalizeUrl(request.url).pathname;
};
