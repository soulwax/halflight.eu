import { error, json, type RequestHandler } from '@sveltejs/kit';
import { applyPlaybackIntent, parsePlaybackIntent } from '#lib/server/playback-state';

/**
 * Applies one named playback mutation against the revision the controller last
 * observed. The playback-state service owns validation, idempotency, and the
 * atomic write; this route only establishes the authenticated product boundary.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	if (!event.request.headers.get('content-type')?.includes('application/json')) {
		error(415, 'Expected a JSON playback intent');
	}

	const payload = await event.request.json().catch(() => null);
	const intent = parsePlaybackIntent(payload);
	if (!intent) error(400, 'Invalid playback intent');

	const result = await applyPlaybackIntent(event.locals.user.id, intent);
	return json(result.state, { status: result.invalid ? 400 : result.conflict ? 409 : 200 });
};
