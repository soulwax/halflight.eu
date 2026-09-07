import { redirect } from '@sveltejs/kit';
import { loadSessionShellData } from '#lib/server/session-shell';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) redirect(302, '/sign-in');

	const shell = await loadSessionShellData(event);
	return {
		user: {
			name: event.locals.user.name || event.locals.user.email,
			isAdministrator: Boolean(event.locals.isAdministrator),
			isFirstAdministrator: Boolean(event.locals.isFirstAdministrator)
		},
		...shell
	};
};
