import { redirect } from '@sveltejs/kit';
import {
	fetchTrackLyrics,
	getConnectionStatus,
	tidalApi,
	TidalApiError,
	TidalAuthError,
	TidalNotConnectedError
} from '#lib/server/tidal';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

const MAX_TRACK_ID_LENGTH = 160;

type TrackPageState =
	'invalid_id' | 'not_connected' | 'authorization_expired' | 'not_found' | 'unavailable';

function failure(state: TrackPageState, configured: boolean, id?: string) {
	return { track: null, state, configured, id };
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	const id = event.params.id;
	if (!id || id.length > MAX_TRACK_ID_LENGTH) return failure('invalid_id', true);

	let connection;
	try {
		connection = await getConnectionStatus();
	} catch {
		return failure('unavailable', true, id);
	}

	if (!connection.connected) return failure('not_connected', connection.configured, id);

	const ctx = { fetch: event.fetch, cookies: event.cookies };

	try {
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
						.getArtistRelationship(firstArtistId, 'tracks', { include: ['albums', 'artists'] }, ctx)
						.catch(() => null)
				: null,
			fetchTrackLyrics(id, { ctx }).catch(() => null)
		]);

		const track = normaliseTrackDetail(document, radioDoc, artistTracksDoc);

		if (!track) return failure('not_found', connection.configured, id);
		return { track, lyrics, state: null, configured: connection.configured, id };
	} catch (error) {
		if (error instanceof TidalNotConnectedError)
			return failure('not_connected', connection.configured, id);
		if (error instanceof TidalAuthError)
			return failure('authorization_expired', connection.configured, id);
		if (error instanceof TidalApiError && error.status === 404)
			return failure('not_found', connection.configured, id);
		return failure('unavailable', connection.configured, id);
	}
};
