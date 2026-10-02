import { error, json } from '@sveltejs/kit';
import {
	getUserPlaylists,
	createUserPlaylist,
	attemptTidalPlaylistSync
} from '#lib/server/playlists';
import { log } from '#lib/server/log';
import type { TrackSummary } from '#lib/tidal/models';
import type { RequestHandler } from './$types';

interface CreatePlaylistPayload {
	id?: string;
	title?: string;
	description?: string;
	items?: TrackSummary[];
	syncTidal?: boolean;
}

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
		error(401, 'Unauthorized');
	}

	try {
		const playlists = await getUserPlaylists(event.locals.user.id);
		return json({ playlists });
	} catch (err) {
		log.error('failed to load user playlists', { cause: err });
		return json({ error: 'failed_to_load_playlists', playlists: [] }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
		error(401, 'Unauthorized');
	}

	let body: CreatePlaylistPayload;
	try {
		body = (await event.request.json()) as CreatePlaylistPayload;
	} catch {
		error(400, 'Invalid JSON body');
	}

	const title = body.title?.trim() || 'Untitled Playlist';
	const description = body.description?.trim();
	const items = Array.isArray(body.items) ? body.items : [];

	try {
		// A retried local save uses the same ID, including after a lost response.
		if (body.id && body.syncTidal !== true) {
			const existing = (await getUserPlaylists(event.locals.user.id)).find(
				(playlist) => playlist.id === body.id
			);
			if (existing) return json({ playlist: existing }, { status: 200 });
		}
		// 1. Attempt optional TIDAL export only on an explicit reviewed request
		let tidalPlaylistId: string | undefined;
		if (body.syncTidal === true && items.length > 0) {
			const trackIds = items.map((t) => t.id).filter(Boolean);
			const syncedUuid = await attemptTidalPlaylistSync(title, description, trackIds, {
				fetch: event.fetch,
				cookies: event.cookies
			});
			if (syncedUuid) {
				tidalPlaylistId = syncedUuid;
			}
		}

		// 2. Persist to user's database account
		const saved = await createUserPlaylist({
			id: body.id,
			userId: event.locals.user.id,
			title,
			description,
			items,
			tidalPlaylistId
		});

		return json({ playlist: saved }, { status: 201 });
	} catch (err) {
		log.error('failed to create user playlist', { cause: err });
		return json({ error: 'failed_to_create_playlist' }, { status: 500 });
	}
};
