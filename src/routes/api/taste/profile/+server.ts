import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import { getTasteProfile, refreshTasteProfile } from '#lib/server/taste/profile';

/** The private profile is derived state only: no catalogue data reaches this route. */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	return json(await getTasteProfile(event.locals.user.id), {
		headers: { 'cache-control': 'private, no-store' }
	});
};

/** Re-read live account signals and atomically replace the owner's derived profile. */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');

	const connection = await getConnectionStatus();
	if (!connection.connected) error(409, 'TIDAL connection required');

	const profile = await refreshTasteProfile(event.locals.user.id, {
		ctx: { fetch: event.fetch, cookies: event.cookies }
	});
	return json(profile, { headers: { 'cache-control': 'private, no-store' } });
};
