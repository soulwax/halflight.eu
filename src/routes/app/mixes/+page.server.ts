import { redirect } from '@sveltejs/kit';
import {
	getConnectionStatus,
	tidalApi,
	TidalAuthError,
	TidalNotConnectedError
} from '#lib/server/tidal';

import { normaliseMixDetail } from '#lib/server/tidal/normalise';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	let connection;
	try {
		connection = await getConnectionStatus();
	} catch {
		return {
			dailyMix: null,
			discoveryMix: null,
			newReleaseMix: null,
			state: 'unavailable',
			connected: false,
			configured: true
		};
	}

	if (!connection.connected) {
		return {
			dailyMix: null,
			discoveryMix: null,
			newReleaseMix: null,
			state: 'not_connected',
			connected: false,
			configured: connection.configured
		};
	}

	const ctx = { fetch: event.fetch, cookies: event.cookies };

	try {
		const [dailyRes, discoveryRes, newReleaseRes] = await Promise.allSettled([
			tidalApi.getMix('daily', { include: ['items', 'artists', 'albums'] }, ctx),
			tidalApi.getMix('discovery', { include: ['items', 'artists', 'albums'] }, ctx),
			tidalApi.getMix('newRelease', { include: ['items', 'artists', 'albums'] }, ctx)
		]);

		const dailyMix =
			dailyRes.status === 'fulfilled' ? normaliseMixDetail(dailyRes.value, 'daily') : null;
		const discoveryMix =
			discoveryRes.status === 'fulfilled'
				? normaliseMixDetail(discoveryRes.value, 'discovery')
				: null;
		const newReleaseMix =
			newReleaseRes.status === 'fulfilled'
				? normaliseMixDetail(newReleaseRes.value, 'newRelease')
				: null;

		return {
			dailyMix,
			discoveryMix,
			newReleaseMix,
			state: null,
			connected: true,
			configured: connection.configured
		};
	} catch (error) {
		if (error instanceof TidalNotConnectedError) {
			return {
				dailyMix: null,
				discoveryMix: null,
				newReleaseMix: null,
				state: 'not_connected',
				connected: false,
				configured: connection.configured
			};
		}
		if (error instanceof TidalAuthError) {
			return {
				dailyMix: null,
				discoveryMix: null,
				newReleaseMix: null,
				state: 'authorization_expired',
				connected: true,
				configured: connection.configured
			};
		}
		return {
			dailyMix: null,
			discoveryMix: null,
			newReleaseMix: null,
			state: 'unavailable',
			connected: true,
			configured: connection.configured
		};
	}
};
