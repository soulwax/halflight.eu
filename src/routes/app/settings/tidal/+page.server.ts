import { getConnectionStatus } from '#lib/server/tidal';
import { readRecord } from '#lib/server/tidal/store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const status = await getConnectionStatus();
	let debugTokens: {
		accessToken: string;
		refreshToken: string;
		expiresAt: number;
		scopes: string[];
	} | null = null;

	if (status.connected) {
		try {
			const record = await readRecord();
			if (record) {
				debugTokens = {
					accessToken: record.accessToken,
					refreshToken: record.refreshToken,
					expiresAt: record.expiresAt,
					scopes: record.scope
				};
			}
		} catch {
			// ignore read errors for optional debug tokens
		}
	}

	const hasFullPlayback = status.scopes?.some((s) => s === 'r_usr' || s.includes('r_usr')) ?? false;

	return {
		status,
		hasFullPlayback,
		debugTokens,
		notice: {
			connected: event.url.searchParams.has('connected'),
			disconnected: event.url.searchParams.has('disconnected'),
			error: event.url.searchParams.get('error')
		}
	};
};
