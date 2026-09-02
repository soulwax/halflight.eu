import { getTidalConfig } from './config';
import { TidalConfigError } from './errors';
import { readPlaybackRecord, readRecord } from './store';
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
	/** `true` when a TIDAL Link (device) token is stored — full playback is available. */
	hasPlayback: boolean;
	/** Scopes on the stored playback token, when linked. */
	playbackScopes?: string[];
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

	if (!configured) return { connected: false, configured, configError, hasPlayback: false };

	let playback: Awaited<ReturnType<typeof readPlaybackRecord>> = null;
	try {
		playback = await readPlaybackRecord(store);
	} catch {
		// An unreadable playback blob just means "no full playback".
	}

	try {
		const record = await readRecord(store);
		if (!record) {
			return {
				connected: false,
				configured,
				hasPlayback: Boolean(playback),
				playbackScopes: playback?.scope
			};
		}
		return {
			connected: true,
			configured,
			scopes: record.scope,
			expiresAt: new Date(record.expiresAt).toISOString(),
			obtainedAt: new Date(record.obtainedAt).toISOString(),
			stale: Date.now() >= record.expiresAt - 60_000,
			tidalUserId: record.userId,
			hasPlayback: Boolean(playback),
			playbackScopes: playback?.scope
		};
	} catch (err) {
		return {
			connected: false,
			configured,
			hasPlayback: Boolean(playback),
			playbackScopes: playback?.scope,
			error: err instanceof Error ? err.message : 'Unknown error reading the token record.'
		};
	}
}
