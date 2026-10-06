import { error, redirect } from '@sveltejs/kit';
import { filterPlayableTracks, getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { TrackSummary } from '#lib/tidal/models';
import type { PageServerLoad } from './$types';

const MIX_LENGTH = 8;

/**
 * Halflight Now's home is one decision deep: resume the session, or start from
 * a short mix rail. The rail reuses the same daily mix the desktop home shows
 * — one call, capped, never a full restacked page.
 */
export const load: PageServerLoad = async (event): Promise<{ dailyMix: TrackSummary[] }> => {
	if (!event.locals.user) redirect(302, '/sign-in');
	if (!event.locals.isListener) error(403, 'Forbidden');

	const connection = await getConnectionStatus();
	if (!connection.connected) return { dailyMix: [] };

	try {
		const document = await tidalApi.getMix(
			'daily',
			{ include: ['artists', 'albums'] },
			{ fetch: event.fetch, cookies: event.cookies }
		);
		const tracks = normaliseSearchResults(document).tracks;
		return { dailyMix: (await filterPlayableTracks(tracks)).slice(0, MIX_LENGTH) };
	} catch {
		return { dailyMix: [] };
	}
};
