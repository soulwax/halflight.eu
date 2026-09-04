import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import { getUserPlaylists } from '#lib/server/playlists';
import type { PageServerLoad } from './$types';

const failure = (state: TidalPageState, configured: boolean, id?: string) => ({
	playlist: null,
	localPlaylist: null,
	isLocal: false,
	syncStatus: null,
	hasWriteScopes: false,
	state,
	configured,
	id
});

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	const id = event.params.id;

	// Dual resolution: Check local custom playlists first
	if (user && id) {
		try {
			const localPlaylists = await getUserPlaylists(user.id);
			const local = localPlaylists.find(
				(p) => p.id === id || (p.tidalPlaylistId && p.tidalPlaylistId === id)
			);
			if (local) {
				const connection = await getConnectionStatus().catch(() => ({
					connected: false,
					configured: false,
					hasWriteScopes: false
				}));
				return {
					playlist: {
						kind: 'playlist' as const,
						id: local.id,
						title: local.title,
						description: local.description ?? undefined,
						numberOfItems: local.items.length,
						items: local.items
					},
					localPlaylist: local,
					isLocal: true,
					syncStatus: local.syncStatus,
					hasWriteScopes: Boolean(connection.hasWriteScopes),
					state: null,
					configured: connection.configured,
					id: local.id
				};
			}
		} catch {
			// Fall through to TIDAL loader
		}
	}

	return loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, tidalId, configured) => {
			const document = await tidalApi.getPlaylist(tidalId, { include: ['items'] }, ctx);
			let playlist = normalisePlaylistDetail(document);

			// A playlist can come back with an empty `items` relationship; the
			// dedicated items endpoint is the fallback.
			if (playlist && playlist.items.length === 0) {
				try {
					const itemsDoc = await tidalApi.getPlaylistItems(tidalId, {}, ctx);
					const detailWithItems = normalisePlaylistDetail({
						...document,
						included: [
							...(document.included ?? []),
							...(itemsDoc.included ?? []),
							...(Array.isArray(itemsDoc.data) ? itemsDoc.data : [itemsDoc.data])
						]
					});
					if (detailWithItems && detailWithItems.items.length > 0) {
						playlist = detailWithItems;
					}
				} catch {
					// Ignore the sub-request error and render what we have.
				}
			}

			if (!playlist) return failure('not_found', configured, tidalId);

			let localPlaylist = null;
			let syncStatus = null;
			if (user) {
				try {
					const localPlaylists = await getUserPlaylists(user.id);
					const match = localPlaylists.find((p) => p.tidalPlaylistId === tidalId);
					if (match) {
						localPlaylist = match;
						syncStatus = match.syncStatus;
					}
				} catch {
					// best-effort
				}
			}

			const conn = await getConnectionStatus().catch(() => ({ hasWriteScopes: false }));

			return {
				playlist,
				localPlaylist,
				isLocal: false,
				syncStatus,
				hasWriteScopes: Boolean(conn.hasWriteScopes),
				state: null,
				configured,
				id: tidalId
			};
		}
	});
};
