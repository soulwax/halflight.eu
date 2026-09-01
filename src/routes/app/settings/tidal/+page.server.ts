import { getConnectionStatus } from '#lib/server/tidal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const status = await getConnectionStatus();

	return {
		status,
		notice: {
			connected: event.url.searchParams.has('connected'),
			disconnected: event.url.searchParams.has('disconnected'),
			error: event.url.searchParams.get('error')
		}
	};
};
