import {
	fetchTrackLyrics,
	filterPlayableTracks,
	getConnectionStatus,
	tidalApi
} from '#lib/server/tidal';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';
import { loadTidalPage, type TidalPageState } from '#lib/server/tidal/load';
import type { PageServerLoad } from './$types';

const failure = (state: TidalPageState, configured: boolean, id?: string) => ({
	track: null,
	state,
	configured,
	id
});

export const load: PageServerLoad = (event) =>
	loadTidalPage(event, {
		getConnectionStatus,
		failure,
		run: async (ctx, id, configured) => {
			const document = await tidalApi.getTrack(id, { include: ['albums', 'artists'] }, ctx);

			const dataObj =
				document.data && typeof document.data === 'object'
					? (document.data as {
							relationships?: Record<string, { data?: Array<{ id: string }> | { id: string } }>;
						})
					: null;
			const artistRel =
				dataObj?.relationships?.artists?.data ?? dataObj?.relationships?.contributors?.data;
			const firstArtistId = Array.isArray(artistRel) ? artistRel[0]?.id : artistRel?.id;

			const [radioDoc, artistTracksDoc, lyrics] = await Promise.all([
				tidalApi
					.getTrackRelationship(id, 'radio', { include: ['albums', 'artists'] }, ctx)
					.catch(() =>
						tidalApi.getTrackRelationship(
							id,
							'similarTracks',
							{ include: ['albums', 'artists'] },
							ctx
						)
					)
					.catch(() => null),
				firstArtistId
					? tidalApi
							.getArtistRelationship(
								firstArtistId,
								'tracks',
								{ include: ['albums', 'artists'] },
								ctx
							)
							.catch(() => null)
					: null,
				fetchTrackLyrics(id, { ctx }).catch(() => null)
			]);

			const track = normaliseTrackDetail(document, radioDoc, artistTracksDoc);
			if (!track) return failure('not_found', configured, id);

			const [radioTracks, artistTopTracks] = await Promise.all([
				track.radioTracks ? filterPlayableTracks(track.radioTracks) : undefined,
				track.artistTopTracks ? filterPlayableTracks(track.artistTopTracks) : undefined
			]);

			return {
				track: { ...track, radioTracks, artistTopTracks },
				lyrics,
				state: null,
				configured,
				id
			};
		}
	});
