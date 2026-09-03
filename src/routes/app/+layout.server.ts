import { redirect } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import { getStreamingSettings } from '#lib/server/streaming-settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) redirect(302, '/sign-in');

	const [connection, streamingSettings] = await Promise.all([
		getConnectionStatus(),
		getStreamingSettings(event.locals.user.id)
	]);
	return {
		user: {
			name: event.locals.user.name || event.locals.user.email
		},
		connection: {
			connected: connection.connected,
			configured: connection.configured
		},
		streamingSettings
	};
};
