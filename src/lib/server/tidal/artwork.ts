import { getPlaybackTokenDetails, type TidalRequestContext } from './client';
import { TidalApiError } from './errors';

const COVER_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const COVER_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_COVER_CACHE_ENTRIES = 200;
const DEFAULT_COUNTRY_CODE = 'DE';

interface LegacyTrackMetadata {
	album?: { cover?: unknown };
	cover?: unknown;
}

interface CoverCacheEntry {
	coverId: string | null;
	expiresAt: number;
}

const coverCache = new Map<string, CoverCacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

interface CoverLookupOptions {
	ctx?: TidalRequestContext;
	accessToken?: string;
	countryCode?: string;
	now?: number;
}

function validCoverId(value: unknown): value is string {
	return typeof value === 'string' && COVER_ID_PATTERN.test(value);
}

/** Build a server-only TIDAL artwork URL from a validated legacy cover UUID. */
export function tidalArtworkUrl(coverId: string, size = '640x640'): string {
	if (!validCoverId(coverId)) throw new Error('Invalid TIDAL artwork identifier.');
	return `https://resources.tidal.com/images/${coverId.replaceAll('-', '/')}/${size}.jpg`;
}

/**
 * Fetch the sole artwork identifier that v2 omits from catalogue responses.
 * The identifier is cached only in process memory; it is never persisted with
 * the profile, playback state, or any catalogue data.
 */
export async function getTrackCoverId(
	trackId: string | number,
	options: CoverLookupOptions = {}
): Promise<string | null> {
	return getCoverId('tracks', String(trackId), options);
}

/** Album tracks share this identifier lookup and the browser's image cache. */
export async function getAlbumCoverId(
	albumId: string | number,
	options: CoverLookupOptions = {}
): Promise<string | null> {
	return getCoverId('albums', String(albumId), options);
}

async function getCoverId(
	resource: 'tracks' | 'albums',
	id: string,
	options: CoverLookupOptions
): Promise<string | null> {
	if (!/^\d+$/.test(id)) return null;
	const key = `${resource}:${id}`;
	const now = options.now ?? Date.now();
	const cached = coverCache.get(key);
	if (cached && cached.expiresAt > now) return cached.coverId;
	const existing = inFlight.get(key);
	if (existing) return existing;
	const request = fetchCoverId(resource, id, options, now).finally(() => inFlight.delete(key));
	inFlight.set(key, request);
	return request;
}

async function fetchCoverId(
	resource: 'tracks' | 'albums',
	id: string,
	options: CoverLookupOptions,
	now: number
): Promise<string | null> {
	const authentication = options.accessToken
		? { accessToken: options.accessToken, countryCode: undefined }
		: await getPlaybackTokenDetails(options.ctx);
	const token = authentication.accessToken;
	const fetchImpl = options.ctx?.fetch ?? fetch;
	// The legacy endpoint requires a market. New device authorization records it;
	// DE bridges device tokens created before that field was retained.
	const countryCode = options.countryCode ?? authentication.countryCode ?? DEFAULT_COUNTRY_CODE;
	const url = `https://api.tidal.com/v1/${resource}/${encodeURIComponent(id)}?countryCode=${encodeURIComponent(countryCode)}`;
	const response = await fetchImpl(url, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		let body: unknown = null;
		try {
			body = await response.json();
		} catch {
			// Keep the upstream body out of logs and user-visible errors.
		}
		throw new TidalApiError(response.status, response.statusText, body, url);
	}

	const metadata = (await response.json()) as LegacyTrackMetadata;
	const rawCoverId = resource === 'albums' ? metadata.cover : metadata.album?.cover;
	const coverId = validCoverId(rawCoverId) ? rawCoverId : null;
	const oldestCachedTrack = coverCache.keys().next().value;
	if (coverCache.size >= MAX_COVER_CACHE_ENTRIES && oldestCachedTrack) {
		coverCache.delete(oldestCachedTrack);
	}
	coverCache.set(`${resource}:${id}`, { coverId, expiresAt: now + COVER_CACHE_TTL_MS });
	return coverId;
}

/** Test-only reset for the process-local, non-durable artwork cache. */
export function resetArtworkCache(): void {
	coverCache.clear();
	inFlight.clear();
}
