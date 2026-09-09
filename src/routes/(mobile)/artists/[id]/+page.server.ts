import { error } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseArtistDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { ArtistDetail } from '#lib/tidal/models';
import type { PageServerLoad } from './$types';

export interface MobileArtistData {
	artist: ArtistDetail | null;
	state: TidalPageState | null;
	id?: string;
}

const failure = (state: TidalPageState, _configured: boolean, id?: string): MobileArtistData => ({
	artist: null,
	state,
	id
});

/**
 * Mobile artist composition — a Halflight Now destination, not the desktop
 * `/app/artists/[id]` page. It fetches enough to decide: identity, top tracks,
 * albums, and radio. Similar artists and full discography pages stay desktop
 * depth. `artists/{id}/relationships/tracks` needs an explicit `collapseBy`
 * (see MASTERPLAN's expansion table) — `FINGERPRINT` collapses duplicate
 * recordings for us.
 */
export const load: PageServerLoad = async (event): Promise<MobileArtistData> => {
	if (!event.locals.isAdministrator) error(403, 'Forbidden');

	return loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const artistDoc = await tidalApi.getArtist(id, {}, ctx);
			const [tracksDoc, albumsDoc, radioDoc] = await Promise.all([
				tidalApi
					.getArtistRelationship(
						id,
						'tracks',
						{ collapseBy: 'FINGERPRINT', include: ['albums', 'artists'] },
						ctx
					)
					.catch(() => null),
				tidalApi
					.getArtistRelationship(id, 'albums', { include: ['artists'] }, ctx)
					.catch(() => null),
				tidalApi
					.getArtistRelationship(id, 'radio', { include: ['albums', 'artists'] }, ctx)
					.catch(() => null)
			]);

			const artist = normaliseArtistDetail(artistDoc, tracksDoc, albumsDoc, null, radioDoc);
			if (!artist) return failure('not_found', configured, id);

			return { artist, state: null, id };
		}
	});
};
