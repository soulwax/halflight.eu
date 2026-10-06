import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	pullPlaylist,
	pushPlaylist,
	pullAllPlaylists,
	pushAllPlaylists
} from '#lib/server/playlists/sync';
import { getUserPlaylists } from '#lib/server/playlists';
import { getConnectionStatus } from '#lib/server/tidal';
import { playlistWorkResponse } from '#lib/server/playlists/response';

/**
 * POST /api/playlists/sync
 *
 * Body:
 *   { action: 'pull' | 'push' | 'pull_all' | 'push_all',
 *     playlistId?: string,           // local playlist ID (for push)
 *     tidalPlaylistId?: string }     // TIDAL playlist UUID (for pull)
 */
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user || !event.locals.isListener) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ error: 'not_connected' }, { status: 503 });
	}

	if (!connection.hasWriteScopes) {
		return json(
			{ error: 'missing_write_scopes', message: 'Reconnect TIDAL with write scopes enabled' },
			{ status: 403 }
		);
	}

	const body = (await event.request.json()) as {
		action?: string;
		playlistId?: string;
		tidalPlaylistId?: string;
	};

	const ctx = {
		userId: user.id,
		fetch: event.fetch,
		cookies: event.cookies
	};

	switch (body.action) {
		case 'pull': {
			if (!body.tidalPlaylistId) {
				error(400, 'tidalPlaylistId required for pull');
			}
			return playlistWorkResponse(() => pullPlaylist(body.tidalPlaylistId!, ctx));
		}

		case 'push': {
			if (!body.playlistId) {
				error(400, 'playlistId required for push');
			}
			const playlists = await getUserPlaylists(user.id);
			const playlist = playlists.find((p) => p.id === body.playlistId);
			if (!playlist) {
				error(404, 'Playlist not found');
			}
			const result = await pushPlaylist(playlist, ctx);
			return json(result);
		}

		case 'pull_all': {
			return playlistWorkResponse(() => pullAllPlaylists(ctx));
		}

		case 'push_all': {
			const result = await pushAllPlaylists(ctx);
			return json(result);
		}

		default:
			error(400, 'Invalid action. Must be: pull, push, pull_all, push_all');
	}
};
