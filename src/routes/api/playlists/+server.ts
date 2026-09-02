import { error, json } from '@sveltejs/kit';
import {
	getUserPlaylists,
	createUserPlaylist,
	attemptTidalPlaylistSync
} from '#lib/server/playlists';
import type { TrackSummary } from '#lib/server/tidal/models';
import type { RequestHandler } from './$types';

interface CreatePlaylistPayload {
	id?: string;
	title?: string;
	description?: string;
	items?: TrackSummary[];
	syncTidal?: boolean;
}

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		const playlists = await getUserPlaylists(event.locals.user.id);
		return json({ playlists });
	} catch (err) {
		console.error('Failed to load user playlists:', err);
		return json({ error: 'failed_to_load_playlists', playlists: [] }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
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
		// 1. Attempt optional TIDAL export if requested/connected
		let tidalPlaylistId: string | undefined;
		if (body.syncTidal !== false && items.length > 0) {
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
		console.error('Failed to create user playlist:', err);
		return json({ error: 'failed_to_create_playlist' }, { status: 500 });
	}
};
