import { filterPlayableTracks, getConnectionStatus, tidalApi } from '#lib/server/tidal';
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
				const items = await filterPlayableTracks(local.items);
				return {
					playlist: {
						kind: 'playlist' as const,
						id: local.id,
						title: local.title,
						description: local.description ?? undefined,
						numberOfItems: items.length,
						items
					},
					localPlaylist: { ...local, items },
					editTracks: local.items,
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

			// A playlist can come back with an empty `items` relationship, or truncated
			// (TIDAL limits include=items to the first page, typically 20 tracks).
			// If numberOfItems indicates more tracks exist or initial items were empty,
			// fetch all items across pages.
			const expectedItems = playlist?.numberOfItems ?? 0;
			if (playlist && (playlist.items.length === 0 || playlist.items.length < expectedItems)) {
				try {
					let fullItems: { items: unknown[]; included?: unknown[] };
					if (typeof tidalApi.getFullPlaylistItems === 'function') {
						fullItems = await tidalApi.getFullPlaylistItems(tidalId, ctx, {
							include: ['artists', 'albums']
						});
					} else {
						const itemsDoc = await tidalApi.getPlaylistItems(tidalId, {}, ctx);
						fullItems = {
							items: Array.isArray(itemsDoc.data) ? itemsDoc.data : [itemsDoc.data],
							included: itemsDoc.included ?? []
						};
					}

					if (fullItems.items.length > 0) {
						const relationships =
							(document.data as { relationships?: Record<string, unknown> })?.relationships ?? {};
						const detailWithItems = normalisePlaylistDetail({
							...document,
							data: {
								...(document.data as object),
								relationships: {
									...relationships,
									items: {
										...((relationships.items as object) ?? {}),
										data: fullItems.items
									}
								}
							},
							included: [
								...(document.included ?? []),
								...(fullItems.included ?? []),
								...fullItems.items
							]
						});
						if (detailWithItems && detailWithItems.items.length > 0) {
							playlist = detailWithItems;
						}
					}
				} catch {
					// Ignore the sub-request error and render what we have.
				}
			}

			if (!playlist) return failure('not_found', configured, tidalId);
			playlist = { ...playlist, items: await filterPlayableTracks(playlist.items) };

			let localPlaylist = null;
			let syncStatus = null;
			if (user) {
				try {
					const localPlaylists = await getUserPlaylists(user.id);
					const match = localPlaylists.find((p) => p.tidalPlaylistId === tidalId);
					if (match) {
						localPlaylist = { ...match, items: await filterPlayableTracks(match.items) };
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
