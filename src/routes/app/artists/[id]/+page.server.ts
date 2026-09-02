import { redirect } from '@sveltejs/kit';
import {
	getConnectionStatus,
	tidalApi,
	TidalApiError,
	TidalAuthError,
	TidalNotConnectedError
} from '#lib/server/tidal';
import { normaliseArtistDetail } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

const MAX_ID_LENGTH = 160;

type ArtistPageState =
	'invalid_id' | 'not_connected' | 'authorization_expired' | 'not_found' | 'unavailable';

function failure(state: ArtistPageState, configured: boolean, id?: string) {
	return { artist: null, state, configured, id };
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	const id = event.params.id;
	if (!id || id.length > MAX_ID_LENGTH) return failure('invalid_id', true);

	let connection;
	try {
		connection = await getConnectionStatus();
	} catch {
		return failure('unavailable', true, id);
	}

	if (!connection.connected) return failure('not_connected', connection.configured, id);

	const ctx = { fetch: event.fetch, cookies: event.cookies };

	try {
		const artistDoc = await tidalApi.getArtist(id, {}, ctx);

		const [tracksDoc, albumsDoc, similarDoc, radioDoc] = await Promise.all([
			tidalApi
				.getArtistRelationship(id, 'tracks', { include: ['albums', 'artists'] }, ctx)
				.catch(() => null),
			tidalApi.getArtistRelationship(id, 'albums', { include: ['artists'] }, ctx).catch(() => null),
			tidalApi.getArtistRelationship(id, 'similarArtists', {}, ctx).catch(() => null),
			tidalApi
				.getArtistRelationship(id, 'radio', { include: ['albums', 'artists'] }, ctx)
				.catch(() => null)
		]);

		const artist = normaliseArtistDetail(artistDoc, tracksDoc, albumsDoc, similarDoc, radioDoc);

		if (!artist) return failure('not_found', connection.configured, id);
		return { artist, state: null, configured: connection.configured, id };
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
