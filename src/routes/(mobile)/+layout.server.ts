import { redirect } from '@sveltejs/kit';
import { loadSessionShellData } from '#lib/server/session-shell';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) redirect(302, '/sign-in');

	return loadSessionShellData(event);
};
