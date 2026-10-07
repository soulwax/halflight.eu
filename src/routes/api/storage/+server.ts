import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getStorageOverview } from '#lib/server/storage';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.isListener) error(401, 'Unauthorized');
	return json(await getStorageOverview(locals.user.id), {
		headers: { 'Cache-Control': 'private, no-store' }
	});
};
