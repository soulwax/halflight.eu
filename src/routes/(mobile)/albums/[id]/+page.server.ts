import { error } from '@sveltejs/kit';
import { filterPlayableTracks, getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseAlbumDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { AlbumDetail } from '#lib/tidal/models';
import type { PageServerLoad } from './$types';

export interface MobileAlbumData {
	album: AlbumDetail | null;
	state: TidalPageState | null;
	id?: string;
}

const failure = (state: TidalPageState, _configured: boolean, id?: string): MobileAlbumData => ({
	album: null,
	state,
	id
});

/**
 * Mobile album composition — a Halflight Now destination, not the desktop
 * `/app/albums/[id]` page. It loads only the album and its items; reviews,
 * credits, and similar albums stay desktop depth. The `(mobile)` layout already
 * redirects a non-owner, but detail loads are reached directly often enough to
 * repeat the guard here (and it keeps this load unit-testable in isolation).
 */
export const load: PageServerLoad = async (event): Promise<MobileAlbumData> => {
	if (!event.locals.isAdministrator) error(403, 'Forbidden');

	return loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const document = await tidalApi.getAlbum(id, { include: ['artists', 'items'] }, ctx);
			const album = normaliseAlbumDetail(document);
			if (!album) return failure('not_found', configured, id);
			return {
				album: { ...album, items: await filterPlayableTracks(album.items) },
				state: null,
				id
			};
		}
	});
};
