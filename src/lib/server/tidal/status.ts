import { getTidalConfig } from './config';
import { TidalConfigError } from './errors';
import { readRecord } from './store';
import type { TokenRowStore } from './store';

export interface TidalConnectionStatus {
	connected: boolean;
	/** `false` when required env vars are missing — connecting is impossible. */
	configured: boolean;
	configError?: string;
	scopes?: string[];
	/** ISO timestamp; when the current access token expires. */
	expiresAt?: string;
	/** ISO timestamp; when the record was last obtained or refreshed. */
	obtainedAt?: string;
	/** `true` when the stored access token is within the refresh window. */
	stale?: boolean;
	tidalUserId?: string;
	/** Present only when the stored record is unreadable (e.g. key changed). */
	error?: string;
}

/**
 * Describe the current connection without ever revealing token material. Safe to
 * return from an endpoint or page load.
 */
export async function getConnectionStatus(store?: TokenRowStore): Promise<TidalConnectionStatus> {
	let configured = true;
	let configError: string | undefined;
	try {
		getTidalConfig();
	} catch (err) {
		if (err instanceof TidalConfigError) {
			configured = false;
			configError = err.message;
		} else {
			throw err;
		}
	}

	if (!configured) return { connected: false, configured, configError };

	try {
		const record = await readRecord(store);
		if (!record) return { connected: false, configured };
		return {
			connected: true,
			configured,
			scopes: record.scope,
			expiresAt: new Date(record.expiresAt).toISOString(),
			obtainedAt: new Date(record.obtainedAt).toISOString(),
			stale: Date.now() >= record.expiresAt - 60_000,
			tidalUserId: record.userId
		};
	} catch (err) {
		return {
			connected: false,
			configured,
			error: err instanceof Error ? err.message : 'Unknown error reading the token record.'
		};
	}
}
