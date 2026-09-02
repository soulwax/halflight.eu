import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requestDeviceAuthorization } from '#lib/server/tidal';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
		error(401, 'Unauthorized');
	}

	try {
		const res = await requestDeviceAuthorization(event.fetch);
		return json(res);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to request device authorization';
		return json({ error: message }, { status: 500 });
	}
};
