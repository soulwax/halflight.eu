import { error, json, type RequestHandler } from '@sveltejs/kit';
import { listImportablePlaylists, pullPlaylist } from '#lib/server/playlists/sync';
import { getConnectionStatus } from '#lib/server/tidal';
import { playlistWorkResponse } from '#lib/server/playlists/response';

const deferredStreamValidation = 'deferred' as const;

function invalidImportSelection() {
	// The chooser can only submit IDs it rendered, but a stale tab or interrupted
	// request must not turn an import attempt into a browser-visible 400. Keep
	// this in the normal import response shape so the client can recover in place.
	return json({
		imported: [],
		totalImported: 0,
		totalErrors: 0,
		totalTracksSkipped: 0,
		totalTracksReplaced: 0,
		streamValidation: deferredStreamValidation,
		error: 'invalid_playlist_selection'
	});
}

/**
 * GET /api/playlists/import
 *
 * List the owner's TIDAL playlists available for import, with an
 * `isImported` flag on each indicating whether it is already linked
 * to a local `user_playlist`.
 */
export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user || !event.locals.isAdministrator) {
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
	if (!user || !event.locals.isAdministrator) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ imported: [], error: 'not_connected' }, { status: 503 });
	}

	const body = (await event.request.json().catch(() => null)) as {
		tidalPlaylistIds?: unknown;
	} | null;
	const tidalPlaylistIds = body?.tidalPlaylistIds;
	if (
		!Array.isArray(tidalPlaylistIds) ||
		tidalPlaylistIds.length === 0 ||
		tidalPlaylistIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 128)
	) {
		return invalidImportSelection();
	}

	// A small batch bounds the work and keeps a failed source playlist isolated.
	// De-duplicate only the request; duplicate tracks inside a playlist stay intact.
	const ids = [...new Set(tidalPlaylistIds.map((id) => id.trim()))].slice(0, 10);
	const ctx = {
		userId: user.id,
		fetch: event.fetch,
		cookies: event.cookies
	};
	return playlistWorkResponse(async () => {
		const imported = [];
		for (const tidalId of ids) {
			const result = await pullPlaylist(tidalId, ctx);
			imported.push(result);
		}
		return {
			imported,
			totalImported: imported.filter((r) => r.status === 'created' || r.status === 'synced').length,
			totalErrors: imported.filter((r) => r.status === 'error').length,
			totalTracksSkipped: imported.reduce((total, result) => total + result.tracksSkipped, 0),
			totalTracksReplaced: imported.reduce((total, result) => total + result.tracksReplaced, 0),
			streamValidation: imported.every((result) => result.streamValidation === 'verified')
				? 'verified'
				: deferredStreamValidation
		};
	});
};
