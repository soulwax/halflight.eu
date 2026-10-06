import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (!event.locals.user || !event.locals.isListener) redirect(302, '/sign-in?returnTo=/');
	return {};
};
