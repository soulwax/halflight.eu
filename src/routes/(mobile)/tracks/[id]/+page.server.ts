import { error } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { TrackDetail } from '#lib/tidal/models';
import type { PageServerLoad } from './$types';

export interface MobileTrackData {
	track: TrackDetail | null;
	state: TidalPageState | null;
	id?: string;
}

const failure = (state: TidalPageState, _configured: boolean, id?: string): MobileTrackData => ({
	track: null,
	state,
	id
});

/**
 * Mobile track composition — a Halflight Now destination and a deep-link
 * target, not the desktop `/app/tracks/[id]` page. It loads the track, its
 * album/artist context, and a radio neighbourhood for the radio verb; lyrics,
 * credits, and the artist's other work stay desktop depth.
 */
export const load: PageServerLoad = async (event): Promise<MobileTrackData> => {
	if (!event.locals.isAdministrator) error(403, 'Forbidden');

	return loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const document = await tidalApi.getTrack(id, { include: ['albums', 'artists'] }, ctx);
			const radioDoc = await tidalApi
				.getTrackRelationship(id, 'radio', { include: ['albums', 'artists'] }, ctx)
				.catch(() =>
					tidalApi.getTrackRelationship(
						id,
						'similarTracks',
						{ include: ['albums', 'artists'] },
						ctx
					)
				)
				.catch(() => null);

			const track = normaliseTrackDetail(document, radioDoc, null);
			if (!track) return failure('not_found', configured, id);

			return { track, state: null, id };
		}
	});
};
