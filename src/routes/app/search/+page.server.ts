import { redirect } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

const MAX_QUERY_LENGTH = 160;
const SEARCH_INCLUDES = ['tracks.artists', 'tracks.albums', 'albums.artists'];

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	const query =
		(event.url.searchParams.get('search') ?? event.url.searchParams.get('q'))?.trim() ?? '';
	const connection = await getConnectionStatus();

	if (!connection.connected || !query) {
		return { query, connected: connection.connected, results: null, error: null };
	}

	if (query.length > MAX_QUERY_LENGTH) {
		return { query, connected: true, results: null, error: 'invalid_query' as const };
	}

	try {
		const document = await tidalApi.search(
			query,
			{
				types: ['tracks', 'albums', 'artists', 'playlists'],
				include: SEARCH_INCLUDES
			},
			{ fetch: event.fetch, cookies: event.cookies }
		);
		return {
			query,
			connected: true,
			results: normaliseSearchResults(document),
			error: null
		};
	} catch {
		return { query, connected: true, results: null, error: 'unavailable' as const };
	}
};
