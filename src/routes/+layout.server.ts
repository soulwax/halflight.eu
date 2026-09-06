import { getUserSettings } from '#lib/server/user-settings';
import { isPublicMobileRoute } from '#lib/mobile/routes';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	// The offline fallback is deliberately public: it must be safe to precache
	// and render during a cold launch without serialising a signed-in account,
	// theme preference, or any listening-session data into the response.
	if (isPublicMobileRoute(event.url.pathname)) {
		return { user: null, theme: null, visualStyle: null };
	}

	const user = event.locals.user
		? {
				name: event.locals.user.name || event.locals.user.email,
				isAdministrator: Boolean(event.locals.isAdministrator),
				isFirstAdministrator: Boolean(event.locals.isFirstAdministrator)
			}
		: null;

	let theme = null;
	let visualStyle = null;

	if (event.locals.user) {
		const settings = await getUserSettings(event.locals.user.id);
		theme = settings.theme;
		visualStyle = settings.visualStyle;
	}

	return {
		user,
		theme,
		visualStyle
	};
};
