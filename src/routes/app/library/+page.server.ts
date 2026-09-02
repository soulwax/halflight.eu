import { redirect } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseCollectionPage } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

type LibraryKind = 'albums' | 'artists' | 'tracks' | 'playlists';

const KINDS: LibraryKind[] = ['albums', 'artists', 'tracks', 'playlists'];

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return { connected: false, sections: null };
	}

	const results = await Promise.all(
		KINDS.map(async (kind) => {
			try {
				const document = await tidalApi.getCollectionPage(
					kind,
					{ include: ['artists', 'albums'] },
					{
						fetch: event.fetch,
						cookies: event.cookies
					}
				);

				const page = normaliseCollectionPage(document);
				return { kind, ok: true as const, page };
			} catch {
				return { kind, ok: false as const };
			}
		})
	);

	return {
		connected: true,
		sections: results.map((result) => {
			if (!result.ok) return { kind: result.kind, ok: false as const };
			const items = result.page[result.kind];
			return {
				kind: result.kind,
				ok: true as const,
				items,
				hasMore: result.page.hasMore
			};
		})
	};
};
