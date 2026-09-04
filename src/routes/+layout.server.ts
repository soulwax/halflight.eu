import { getUserSettings } from '#lib/server/user-settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = event.locals.user
		? {
				name: event.locals.user.name || event.locals.user.email
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
