import { json, error } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Not authenticated');
	return json(await getConnectionStatus());
};
