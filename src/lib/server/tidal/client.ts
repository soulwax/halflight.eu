import { TIDAL_API_BASE } from './config';
import {
	TidalApiError,
	TidalAuthError,
	TidalNotConnectedError,
	TidalPlaybackNotLinkedError
} from './errors';
import { refreshTokens } from './oauth';
import { refreshDeviceToken } from './device-auth';
import {
	readPlaybackRecord,
	readRecord,
	writePlaybackRecord,
	writeRecord,
	type TidalTokenRecord,
	type TokenRowStore
} from './store';
import type { Cookies } from '@sveltejs/kit';

/** Refresh this many ms before the real expiry to absorb clock skew / latency. */
const EXPIRY_SKEW_MS = 60_000;
const TRANSIENT_READ_STATUSES = new Set([408, 500, 502, 503, 504]);
const MAX_TRANSIENT_READ_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 100;

export interface TidalRequestContext {
	/** Injected fetch (e.g. SvelteKit's `event.fetch`); defaults to global `fetch`. */
	fetch?: typeof fetch;
	/** Injected row store; defaults to the Postgres-backed store. */
	store?: TokenRowStore;
	/** Kept for request compatibility; token material is always resolved from the user's DB row. */
	cookies?: Cookies;
}

/**
 * Module-level single-flight guard: concurrent callers that all notice an
 * expired token share one refresh round-trip instead of racing (and possibly
 * invalidating each other's rotated refresh token).
 */
let inFlightRefresh: Promise<TidalTokenRecord> | null = null;

async function loadRecord(store?: TokenRowStore): Promise<TidalTokenRecord> {
	const record = await readRecord(store);
	if (!record) throw new TidalNotConnectedError();
	return record;
}

async function refreshAndPersist(
	record: TidalTokenRecord,
	ctx: TidalRequestContext
): Promise<TidalTokenRecord> {
	if (!inFlightRefresh) {
		inFlightRefresh = (async () => {
			const next = await refreshTokens(
				record.refreshToken,
				ctx.fetch ?? fetch,
				record.scope,
				record.countryCode
			);
			await writeRecord(next, ctx.store);
			return next;
		})().finally(() => {
			inFlightRefresh = null;
		});
	}
	const next = await inFlightRefresh;
	return next;
}

function isExpired(record: TidalTokenRecord, now = Date.now()): boolean {
	return now >= record.expiresAt - EXPIRY_SKEW_MS;
}

/**
 * Return a valid access token, refreshing (and persisting the rotated tokens)
 * first if the stored one is at or near expiry.
 *
 * @throws {TidalNotConnectedError} when no account is connected
 * @throws {TidalAuthError} when the refresh token is no longer accepted
 */
export async function getAccessToken(ctx: TidalRequestContext = {}): Promise<string> {
	let record = await loadRecord(ctx.store);
	if (isExpired(record)) {
		record = await refreshAndPersist(record, ctx);
	}
	return record.accessToken;
}

/** Single-flight guard for the device (playback) token refresh. */
let inFlightPlaybackRefresh: Promise<TidalTokenRecord> | null = null;

/**
 * Return a valid TIDAL Link (device-authorization) access token for the legacy
 * `api.tidal.com/v1` playback surface, refreshing with the device credentials
 * first if the stored one is near expiry.
 *
 * @throws {TidalPlaybackNotLinkedError} when no device token is stored
 * @throws {TidalAuthError} when the device refresh token is rejected
 */
export async function getPlaybackToken(ctx: TidalRequestContext = {}): Promise<string> {
	const record = await readPlaybackRecord(ctx.store);
	if (!record) throw new TidalPlaybackNotLinkedError();
	if (!isExpired(record)) return record.accessToken;

	if (!inFlightPlaybackRefresh) {
		inFlightPlaybackRefresh = (async () => {
			const next = await refreshDeviceToken(
				record.refreshToken,
				ctx.fetch ?? fetch,
				record.countryCode
			);
			await writePlaybackRecord(next, ctx.store);
			return next;
		})().finally(() => {
			inFlightPlaybackRefresh = null;
		});
	}
	return (await inFlightPlaybackRefresh).accessToken;
}

/** Read the stored market for legacy API endpoints that require one. */
export async function getPlaybackCountryCode(
	ctx: TidalRequestContext = {}
): Promise<string | undefined> {
	return (await readPlaybackRecord(ctx.store))?.countryCode;
}

function resolveUrl(path: string): string {
	if (/^https?:\/\//.test(path)) return path;
	return `${TIDAL_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function isSafeRead(init: RequestInit): boolean {
	const method = (init.method ?? 'GET').toUpperCase();
	return method === 'GET' || method === 'HEAD';
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform an authenticated TIDAL API request. Injects the bearer token, sends
 * the JSON:API `Accept` header, retries transient failures for safe reads, and
 * — on a 401 — forces one refresh and retries exactly once before giving up.
 */
export async function tidalFetch(
	path: string,
	init: RequestInit = {},
	ctx: TidalRequestContext = {}
): Promise<Response> {
	const f = ctx.fetch ?? fetch;
	const url = resolveUrl(path);

	const send = (token: string) =>
		f(url, {
			...init,
			headers: {
				accept: 'application/vnd.api+json',
				...init.headers,
				authorization: `Bearer ${token}`
			}
		});

	const sendWithTransientRetry = async (token: string): Promise<Response> => {
		const retries = isSafeRead(init) ? MAX_TRANSIENT_READ_RETRIES : 0;

		for (let attempt = 0; ; attempt += 1) {
			try {
				const response = await send(token);
				if (!TRANSIENT_READ_STATUSES.has(response.status) || attempt === retries) {
					return response;
				}
			} catch (reason) {
				if (
					attempt === retries ||
					(reason instanceof DOMException && reason.name === 'AbortError')
				) {
					throw reason;
				}
			}

			await wait(INITIAL_RETRY_DELAY_MS * 2 ** attempt);
		}
	};

	let response = await sendWithTransientRetry(await getAccessToken(ctx));
	if (response.status === 401) {
		const next = await refreshAndPersist(await loadRecord(ctx.store), ctx);
		response = await sendWithTransientRetry(next.accessToken);
		if (response.status === 401) throw new TidalAuthError();
	}
	return response;
}

async function parseBody(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/** Like {@link tidalFetch} but parses JSON and throws {@link TidalApiError} on non-2xx. */
export async function tidalJson<T = unknown>(
	path: string,
	init: RequestInit = {},
	ctx: TidalRequestContext = {}
): Promise<T> {
	const response = await tidalFetch(path, init, ctx);
	const body = await parseBody(response);
	if (!response.ok) {
		throw new TidalApiError(response.status, response.statusText, body, path);
	}
	return body as T;
}

/** Test-only: clear the single-flight refresh guards between cases. */
export function resetRefreshGuard(): void {
	inFlightRefresh = null;
	inFlightPlaybackRefresh = null;
}
