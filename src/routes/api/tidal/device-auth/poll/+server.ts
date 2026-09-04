import { error, json, type RequestHandler } from '@sveltejs/kit';
import { pollDeviceToken, writePlaybackRecord } from '#lib/server/tidal';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	let body: { deviceCode?: string };
	try {
		body = (await event.request.json()) as { deviceCode?: string };
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (!body.deviceCode) {
		error(400, 'deviceCode is required');
	}

	try {
		const result = await pollDeviceToken(body.deviceCode, event.fetch);

		if (result.status === 'success') {
			// The device token is the playback credential (r_usr). It is stored in
			// its own slot so it never clobbers the developer OAuth browse token.
			await writePlaybackRecord(result.record);
			return json({ status: 'success' });
		}

		return json({ status: result.status });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Error polling device token';
		return json({ status: 'error', error: message }, { status: 400 });
	}
};
