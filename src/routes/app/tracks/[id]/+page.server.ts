import { redirect } from '@sveltejs/kit';
import {
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

	try {
		const document = await tidalApi.getTrack(
			id,
			{ include: ['albums', 'artists'] },
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const track = normaliseTrackDetail(document);

		if (!track) return failure('not_found', connection.configured, id);
		return { track, state: null, configured: connection.configured, id };
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
