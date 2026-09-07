import { isPublicMobileRoute } from '#lib/mobile/routes';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	// The offline fallback is deliberately public: it must be safe to precache
	// and render during a cold launch without serialising a signed-in account or
	// any listening-session data into the response.
	if (isPublicMobileRoute(event.url.pathname)) {
		return { user: null };
	}

	const user = event.locals.user
		? {
				name: event.locals.user.name || event.locals.user.email,
				isAdministrator: Boolean(event.locals.isAdministrator),
				isFirstAdministrator: Boolean(event.locals.isFirstAdministrator)
			}
		: null;

	return {
		user
	};
};
