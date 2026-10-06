import { redirect } from '@sveltejs/kit';
import { loadSessionShellData } from '#lib/server/session-shell';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user || !event.locals.isListener)
		redirect(302, `/sign-in?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}`);

	return loadSessionShellData(event);
};
