import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	parsePlaybackState,
	parsePlaybackStateOrigin,
	parsePlaybackStateRevision,
	savePlaybackState,
	getPlaybackState
} from '#lib/server/playback-state';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	return json(await getPlaybackState(event.locals.user.id));
};

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
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

	const result = await savePlaybackState(event.locals.user.id, state, revision, origin);
	return json(result.state, { status: result.conflict ? 409 : 200 });
};
