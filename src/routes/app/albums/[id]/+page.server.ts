import { redirect } from '@sveltejs/kit';
import {
	fetchAlbumCredits,
	fetchAlbumReview,
	getConnectionStatus,
	tidalApi,
	TidalApiError,
	TidalAuthError,
	TidalNotConnectedError
} from '#lib/server/tidal';
import { normaliseAlbumDetail } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

const MAX_ID_LENGTH = 160;

type AlbumPageState =
	'invalid_id' | 'not_connected' | 'authorization_expired' | 'not_found' | 'unavailable';

function failure(state: AlbumPageState, configured: boolean, id?: string) {
	return { album: null, state, configured, id };
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
		const [document, similarDoc, review, credits] = await Promise.all([
			tidalApi.getAlbum(id, { include: ['artists', 'items'] }, ctx),
			tidalApi
				.getAlbumRelationship(id, 'similarAlbums', { include: ['artists'] }, ctx)
				.catch(() => null),
			fetchAlbumReview(id, { ctx }).catch(() => null),
			fetchAlbumCredits(id, { ctx }).catch(() => null)
		]);

		const album = normaliseAlbumDetail(document, similarDoc);

		if (!album) return failure('not_found', connection.configured, id);
		return { album, review, credits, state: null, configured: connection.configured, id };
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
