import { error } from '@sveltejs/kit';
import { getUserPlaylists } from '#lib/server/playlists';
import { filterPlayableTracks, getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { PlaylistDetail } from '#lib/tidal/models';
import type { PageServerLoad } from './$types';

export interface MobilePlaylistData {
	playlist: PlaylistDetail | null;
	isLocal: boolean;
	state: TidalPageState | null;
	id?: string;
}

const failure = (state: TidalPageState, _configured: boolean, id?: string): MobilePlaylistData => ({
	playlist: null,
	isLocal: false,
	state,
	id
});

/**
 * Mobile playlist composition — a Halflight Now destination, not the desktop
 * `/app/playlists/[id]` page. It resolves the owner's saved playlists first,
 * then a TIDAL playlist with all items paged in; editing, sync, and scope
 * detail stay desktop work.
 */
export const load: PageServerLoad = async (event): Promise<MobilePlaylistData> => {
	if (!event.locals.isAdministrator) error(403, 'Forbidden');

	const user = event.locals.user;
	const id = event.params.id;

	if (user && id) {
		try {
			const local = (await getUserPlaylists(user.id)).find(
				(candidate) => candidate.id === id || candidate.tidalPlaylistId === id
			);
			if (local) {
				const items = await filterPlayableTracks(local.items);
				return {
					playlist: {
						kind: 'playlist',
						id: local.id,
						title: local.title,
						description: local.description ?? undefined,
						numberOfItems: items.length,
						items
					},
					isLocal: true,
					state: null,
					id: local.id
				};
			}
		} catch {
			// Not a saved playlist we can read — try TIDAL.
		}
	}

	return loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, tidalId, configured) => {
			const document = await tidalApi.getFullPlaylist(tidalId, {}, ctx);
			const playlist = normalisePlaylistDetail(document);
			if (!playlist) return failure('not_found', configured, tidalId);
			return {
				playlist: { ...playlist, items: await filterPlayableTracks(playlist.items) },
				isLocal: false,
				state: null,
				id: tidalId
			};
		}
	});
};
