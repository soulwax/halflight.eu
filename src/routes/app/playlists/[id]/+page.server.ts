import { redirect } from '@sveltejs/kit';
import {
	getConnectionStatus,
	tidalApi,
	TidalApiError,
	TidalAuthError,
	TidalNotConnectedError
} from '#lib/server/tidal';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

const MAX_ID_LENGTH = 160;

type PlaylistPageState =
	'invalid_id' | 'not_connected' | 'authorization_expired' | 'not_found' | 'unavailable';

function failure(state: PlaylistPageState, configured: boolean, id?: string) {
	return { playlist: null, state, configured, id };
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
		const document = await tidalApi.getPlaylist(id, { include: ['items'] }, ctx);
		let playlist = normalisePlaylistDetail(document);

		// If playlist has 0 items but there might be items via relationship endpoint, attempt to fetch
		if (playlist && playlist.items.length === 0) {
			try {
				const itemsDoc = await tidalApi.getPlaylistItems(id, {}, ctx);
				const detailWithItems = normalisePlaylistDetail({
					...document,
					included: [
						...(document.included ?? []),
						...(itemsDoc.included ?? []),
						...(Array.isArray(itemsDoc.data) ? itemsDoc.data : [itemsDoc.data])
					]
				});
				if (detailWithItems && detailWithItems.items.length > 0) {
					playlist = detailWithItems;
				}
			} catch {
				// Ignore sub-request error and proceed with playlist
			}
		}

		if (!playlist) return failure('not_found', connection.configured, id);
		return { playlist, state: null, configured: connection.configured, id };
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
