import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	claimPlaybackDevice,
	parsePlaybackDeviceId,
	parsePlaybackStateOrigin
} from '#lib/server/playback-state';

/** Explicitly move the shared resume-point lease to this browser device. */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	if (!event.request.headers.get('content-type')?.includes('application/json')) {
		error(415, 'Expected a JSON playback claim');
	}

	const body = await event.request.json().catch(() => null);
	const payload =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
	const deviceId = parsePlaybackDeviceId(payload?.deviceId);
	const origin = parsePlaybackStateOrigin(payload?.origin);
	if (!deviceId || !origin) error(400, 'A valid playback device and origin are required');

	return json(await claimPlaybackDevice(event.locals.user.id, deviceId, origin));
};
