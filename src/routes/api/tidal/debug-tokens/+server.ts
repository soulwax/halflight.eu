import { json } from '@sveltejs/kit';
import { readPlaybackRecord, readRecord } from '#lib/server/tidal/store.js';
import type { RequestHandler } from './$types';

const noStore = {
	'cache-control': 'private, no-store, max-age=0',
	pragma: 'no-cache',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};

/**
 * Explicit owner-only token inspection for manual TIDAL API debugging. Tokens
 * are decrypted only for this request and are never included in page loads.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) {
		return json({ error: 'unauthorized' }, { status: 401, headers: noStore });
	}

	try {
		const [browse, playback] = await Promise.all([readRecord(), readPlaybackRecord()]);
		if (!browse && !playback) {
			return json({ error: 'tidal_connection_required' }, { status: 404, headers: noStore });
		}

		const expose = (record: Awaited<ReturnType<typeof readRecord>>) =>
			record
				? {
						accessToken: record.accessToken,
						refreshToken: record.refreshToken,
						tokenType: record.tokenType,
						scopes: record.scope,
						expiresAt: new Date(record.expiresAt).toISOString()
					}
				: null;

		return json(
			{ browse: expose(browse), playback: expose(playback) },
			{ headers: { ...noStore, vary: 'Cookie' } }
		);
	} catch {
		// Never forward storage, decryption, or provider details into the response.
		return json({ error: 'token_records_unavailable' }, { status: 503, headers: noStore });
	}
};
