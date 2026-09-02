import { tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { connection } = await event.parent();
	if (!connection.connected) return { dailyMix: [] };

	try {
		const document = await tidalApi.getMix(
			'daily',
			{ include: ['artists', 'albums'] },
			{ fetch: event.fetch, cookies: event.cookies }
		);
		return { dailyMix: normaliseSearchResults(document).tracks.slice(0, 6) };
	} catch {
		return { dailyMix: [] };
	}
};
