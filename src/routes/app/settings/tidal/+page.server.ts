import { getConnectionStatus } from '#lib/server/tidal';
import { readPlaybackRecord, readRecord } from '#lib/server/tidal/store';
import type { PageServerLoad } from './$types';

type DebugToken = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scopes: string[];
};

async function debugToken(read: () => Promise<Awaited<ReturnType<typeof readRecord>>>) {
	try {
		const record = await read();
		if (!record) return null;
		return {
			accessToken: record.accessToken,
			refreshToken: record.refreshToken,
			expiresAt: record.expiresAt,
			scopes: record.scope
		} satisfies DebugToken;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async (event) => {
	const status = await getConnectionStatus();

	const [debugTokens, playbackDebugTokens] = await Promise.all([
		status.connected ? debugToken(() => readRecord()) : Promise.resolve(null),
		status.hasPlayback ? debugToken(() => readPlaybackRecord()) : Promise.resolve(null)
	]);

	return {
		status,
		hasFullPlayback: status.hasPlayback,
		debugTokens,
		playbackDebugTokens,
		notice: {
			connected: event.url.searchParams.has('connected'),
			disconnected: event.url.searchParams.has('disconnected'),
			error: event.url.searchParams.get('error')
		}
	};
};
