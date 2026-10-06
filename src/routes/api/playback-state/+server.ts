import { error, json, type RequestHandler } from '@sveltejs/kit';
import { recoverBufferedPlayback } from '#lib/server/playback-buffer';
import {
	parsePlaybackState,
	parsePlaybackDeviceId,
	parsePlaybackStateOrigin,
	parsePlaybackStateRevision,
	savePlaybackState,
	getPlaybackState
} from '#lib/server/playback-state';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	const deviceId = parsePlaybackDeviceId(event.request.headers.get('x-halflight-playback-device'));
	await recoverBufferedPlayback(event.locals.user.id);
	return json(await getPlaybackState(event.locals.user.id, undefined, deviceId));
};

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	if (!event.request.headers.get('content-type')?.includes('application/json')) {
		error(415, 'Expected a JSON playback state');
	}

	const payload = await event.request.json().catch(() => null);
	const state = parsePlaybackState(payload);
	if (!state) error(400, 'Invalid playback state');
	const body =
		typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
	const revision = parsePlaybackStateRevision(body.revision);
	const origin = parsePlaybackStateOrigin(body.origin);
	if (revision === null || !origin) error(400, 'A valid playback revision and origin are required');
	const deviceId = body.deviceId == null ? null : parsePlaybackDeviceId(body.deviceId);
	if (body.deviceId != null && !deviceId) error(400, 'A valid playback device is required');

	const result = await savePlaybackState(
		event.locals.user.id,
		state,
		revision,
		origin,
		undefined,
		deviceId
	);
	return json(result.state, { status: result.conflict ? 409 : 200 });
};
