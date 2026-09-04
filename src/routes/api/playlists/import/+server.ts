import { error, json, type RequestHandler } from '@sveltejs/kit';
import { listImportablePlaylists, pullPlaylist } from '#lib/server/playlists/sync';
import { getConnectionStatus } from '#lib/server/tidal';

/**
 * GET /api/playlists/import
 *
 * List the owner's TIDAL playlists available for import, with an
 * `isImported` flag on each indicating whether it is already linked
 * to a local `user_playlist`.
 */
export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ playlists: [], error: 'not_connected' }, { status: 503 });
	}

	const ctx = { userId: user.id, fetch: event.fetch, cookies: event.cookies };
	const result = await listImportablePlaylists(ctx);
	return json(result);
};

/**
 * POST /api/playlists/import
 *
 * Import selected TIDAL playlists into Halflight.
 * Body: { tidalPlaylistIds: string[] }
 */
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ imported: [], error: 'not_connected' }, { status: 503 });
	}

	const body = (await event.request.json()) as { tidalPlaylistIds?: string[] };
	if (
		!body.tidalPlaylistIds ||
		!Array.isArray(body.tidalPlaylistIds) ||
		body.tidalPlaylistIds.length === 0
	) {
		error(400, 'tidalPlaylistIds array required');
	}

	// Limit to 50 at once to avoid timeouts
	const ids = body.tidalPlaylistIds.slice(0, 50);
	const ctx = {
		userId: user.id,
		fetch: event.fetch,
		cookies: event.cookies,
		validateStreams: connection.hasPlayback
	};
	const imported = [];

	for (const tidalId of ids) {
		const result = await pullPlaylist(tidalId, ctx);
		imported.push(result);
	}

	return json({
		imported,
		totalImported: imported.filter((r) => r.status === 'created' || r.status === 'synced').length,
		totalErrors: imported.filter((r) => r.status === 'error').length,
		totalTracksSkipped: imported.reduce((total, result) => total + result.tracksSkipped, 0),
		totalTracksReplaced: imported.reduce((total, result) => total + result.tracksReplaced, 0),
		streamValidation: connection.hasPlayback ? 'verified' : 'unavailable'
	});
};
