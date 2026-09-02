import { error, json, type RequestHandler } from '@sveltejs/kit';
import { fetchUserFavorites, getConnectionStatus } from '#lib/server/tidal';

export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const status = await getConnectionStatus();
	if (!status.connected) {
		return json({ connected: false, favorites: null }, { status: 503 });
	}

	const tidalUserId = status.tidalUserId;
	if (!tidalUserId) {
		return json({ connected: true, favorites: null, reason: 'missing_user_id' });
	}

	try {
		const favorites = await fetchUserFavorites(tidalUserId, {
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});

		return json({
			connected: true,
			favorites
		});
	} catch (err) {
		return json(
			{
				connected: true,
				favorites: null,
				error: err instanceof Error ? err.message : 'failed_to_fetch_favorites'
			},
			{ status: 502 }
		);
	}
};
