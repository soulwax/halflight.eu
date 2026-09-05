import { error, redirect } from '@sveltejs/kit';
import { getUserPlaylists } from '#lib/server/playlists';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseCollectionPage } from '#lib/server/tidal/normalise';
import type { MobileLibraryData } from '#lib/tidal/mobile-library';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async (event): Promise<MobileLibraryData> => {
	if (!event.locals.user) redirect(302, '/sign-in');
	if (!event.locals.isAdministrator) error(403, 'Forbidden');

	const tab = event.url.searchParams.get('tab') === 'tracks' ? 'tracks' : 'saved';
	const result: MobileLibraryData = {
		tab,
		status: 'ready',
		playlists: [],
		tracks: [],
		previousQuery: null,
		nextQuery: null,
		hasMore: false
	};

	try {
		if (tab === 'saved') {
			const playlists = await getUserPlaylists(event.locals.user.id);
			const requestedPage = Number(event.url.searchParams.get('page') ?? 1);
			const lastPage = Math.max(1, Math.ceil(playlists.length / PAGE_SIZE));
			const page =
				Number.isSafeInteger(requestedPage) && requestedPage > 0
					? Math.min(requestedPage, lastPage)
					: 1;
			result.playlists = playlists
				.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
				.map(({ id, title, items }) => ({ id, title, items }));
			result.previousQuery = page > 1 ? `tab=saved&page=${page - 1}` : null;
			result.nextQuery = page < lastPage ? `tab=saved&page=${page + 1}` : null;
			return result;
		}

		const connection = await getConnectionStatus();
		if (!connection.connected) return { ...result, status: 'disconnected' };
		const cursor = event.url.searchParams.get('cursor') || undefined;
		if (cursor && cursor.length > 2048) return { ...result, status: 'unavailable' };
		const document = await tidalApi.getCollectionPage(
			'tracks',
			{
				include: ['artists', 'albums'],
				cursor
			},
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const collection = normaliseCollectionPage(document);
		result.tracks = collection.tracks;
		result.hasMore = collection.hasMore;
		result.previousQuery = cursor ? 'tab=tracks' : null;
		// Only forward an opaque cursor to the fixed collection endpoint. Provider
		// pagination URLs and other query fields never become client navigation.
		if (document.links?.next) {
			const next = new URL(document.links.next, 'https://openapi.tidal.com').searchParams.get(
				'page[cursor]'
			);
			if (next && next.length <= 2048 && next !== cursor) {
				result.nextQuery = new URLSearchParams({ tab: 'tracks', cursor: next }).toString();
			}
		}
		return result;
	} catch {
		return { ...result, status: 'unavailable' };
	}
};
