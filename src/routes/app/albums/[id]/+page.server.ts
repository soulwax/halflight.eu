import {
	fetchAlbumCredits,
	fetchAlbumReview,
	getConnectionStatus,
	tidalApi
} from '#lib/server/tidal';
import { normaliseAlbumDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { PageServerLoad } from './$types';

const failure = (state: TidalPageState, configured: boolean, id?: string) => ({
	album: null,
	state,
	configured,
	id
});

export const load: PageServerLoad = (event) =>
	loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const [document, similarDoc, review, credits] = await Promise.all([
				tidalApi.getAlbum(id, { include: ['artists', 'items'] }, ctx),
				tidalApi
					.getAlbumRelationship(id, 'similarAlbums', { include: ['artists'] }, ctx)
					.catch(() => null),
				fetchAlbumReview(id, { ctx }).catch(() => null),
				fetchAlbumCredits(id, { ctx }).catch(() => null)
			]);

			const album = normaliseAlbumDetail(document, similarDoc);
			if (!album) return failure('not_found', configured, id);

			return { album, review, credits, state: null, configured, id };
		}
	});
