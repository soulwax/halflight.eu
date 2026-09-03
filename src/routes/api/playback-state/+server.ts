import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	parsePlaybackState,
	savePlaybackState,
	getPlaybackState
} from '#lib/server/playback-state';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	return json(await getPlaybackState(event.locals.user.id));
};

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	if (!event.request.headers.get('content-type')?.includes('application/json')) {
		error(415, 'Expected a JSON playback state');
	}

	const state = parsePlaybackState(await event.request.json().catch(() => null));
	if (!state) error(400, 'Invalid playback state');
	return json(await savePlaybackState(event.locals.user.id, state));
};
