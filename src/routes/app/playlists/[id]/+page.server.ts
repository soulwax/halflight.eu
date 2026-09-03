import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { PageServerLoad } from './$types';

const failure = (state: TidalPageState, configured: boolean, id?: string) => ({
	playlist: null,
	state,
	configured,
	id
});

export const load: PageServerLoad = (event) =>
	loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const document = await tidalApi.getPlaylist(id, { include: ['items'] }, ctx);
			let playlist = normalisePlaylistDetail(document);

			// A playlist can come back with an empty `items` relationship; the
			// dedicated items endpoint is the fallback.
			if (playlist && playlist.items.length === 0) {
				try {
					const itemsDoc = await tidalApi.getPlaylistItems(id, {}, ctx);
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

			if (!playlist) return failure('not_found', configured, id);
			return { playlist, state: null, configured, id };
		}
	});
