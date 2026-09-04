import { error, json } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { RequestHandler } from './$types';

const MAX_QUERY_LENGTH = 160;
const SEARCH_INCLUDES = ['tracks.artists', 'tracks.albums', 'albums.artists'];

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const q = (event.url.searchParams.get('search') ?? event.url.searchParams.get('q'))?.trim() ?? '';
	if (!q) {
		return json({
			results: { tracks: [], albums: [], artists: [], playlists: [] }
		});
	}

	if (q.length > MAX_QUERY_LENGTH) {
		error(400, 'Search query too long');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ results: null, error: 'not_connected' }, { status: 503 });
	}

	try {
		const doc = await tidalApi.search(
			q,
			{
				types: ['tracks', 'albums', 'artists', 'playlists'],
				include: SEARCH_INCLUDES
			},
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const results = normaliseSearchResults(doc);
		return json({ results });
	} catch {
		return json({ results: null, error: 'search_failed' }, { status: 502 });
	}
};
