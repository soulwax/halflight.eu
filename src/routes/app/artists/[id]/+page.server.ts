import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseArtistDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { PageServerLoad } from './$types';

const failure = (state: TidalPageState, configured: boolean, id?: string) => ({
	artist: null,
	state,
	configured,
	id
});

export const load: PageServerLoad = (event) =>
	loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const artistDoc = await tidalApi.getArtist(id, {}, ctx);

			const [tracksDoc, albumsDoc, similarDoc, radioDoc] = await Promise.all([
				tidalApi
					.getArtistRelationship(id, 'tracks', { include: ['albums', 'artists'] }, ctx)
					.catch(() => null),
				tidalApi
					.getArtistRelationship(id, 'albums', { include: ['artists'] }, ctx)
					.catch(() => null),
				tidalApi.getArtistRelationship(id, 'similarArtists', {}, ctx).catch(() => null),
				tidalApi
					.getArtistRelationship(id, 'radio', { include: ['albums', 'artists'] }, ctx)
					.catch(() => null)
			]);

			const artist = normaliseArtistDetail(artistDoc, tracksDoc, albumsDoc, similarDoc, radioDoc);
			if (!artist) return failure('not_found', configured, id);

			return { artist, state: null, configured, id };
		}
	});
