import { error, json } from '@sveltejs/kit';
import { updateUserPlaylist, deleteUserPlaylist } from '#lib/server/playlists';
import { log } from '#lib/server/log';
import type { TrackSummary } from '#lib/tidal/models';
import type { RequestHandler } from './$types';

interface UpdatePlaylistPayload {
	title?: string;
	description?: string;
	items?: TrackSummary[];
	tidalPlaylistId?: string;
}

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
		error(401, 'Unauthorized');
	}

	const playlistId = event.params.id;
	if (!playlistId) {
		error(400, 'Missing playlist ID');
	}

	let body: UpdatePlaylistPayload;
	try {
		body = (await event.request.json()) as UpdatePlaylistPayload;
	} catch {
		error(400, 'Invalid JSON body');
	}

	try {
		const updated = await updateUserPlaylist(event.locals.user.id, playlistId, {
			title: body.title,
			description: body.description,
			items: body.items,
			tidalPlaylistId: body.tidalPlaylistId
		});

		if (!updated) {
			error(404, 'Playlist not found');
		}

		return json({ playlist: updated });
	} catch (err) {
		log.error('failed to update playlist', { playlistId, cause: err });
		return json({ error: 'failed_to_update_playlist' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
		error(401, 'Unauthorized');
	}

	const playlistId = event.params.id;
	if (!playlistId) {
		error(400, 'Missing playlist ID');
	}

	try {
		const deleted = await deleteUserPlaylist(event.locals.user.id, playlistId);
		if (!deleted) {
			return json({ error: 'playlist_not_found' }, { status: 404 });
		}
		return json({ success: true, id: playlistId });
	} catch (err) {
		log.error('failed to delete playlist', { playlistId, cause: err });
		return json({ error: 'failed_to_delete_playlist' }, { status: 500 });
	}
};
