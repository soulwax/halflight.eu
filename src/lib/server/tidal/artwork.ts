import { getPlaybackToken, type TidalRequestContext } from './client';
import { TidalApiError } from './errors';

const COVER_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const COVER_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_COVER_CACHE_ENTRIES = 200;

interface LegacyTrackMetadata {
	album?: { cover?: unknown };
}

interface CoverCacheEntry {
	coverId: string | null;
	expiresAt: number;
}

const coverCache = new Map<string, CoverCacheEntry>();

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
	options: { ctx?: TidalRequestContext; accessToken?: string; now?: number } = {}
): Promise<string | null> {
	const id = String(trackId);
	if (!/^\d+$/.test(id)) return null;
	const now = options.now ?? Date.now();
	const cached = coverCache.get(id);
	if (cached && cached.expiresAt > now) return cached.coverId;

	const token = options.accessToken ?? (await getPlaybackToken(options.ctx));
	const fetchImpl = options.ctx?.fetch ?? fetch;
	const url = `https://api.tidal.com/v1/tracks/${encodeURIComponent(id)}`;
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
	const rawCoverId = metadata.album?.cover;
	const coverId = validCoverId(rawCoverId) ? rawCoverId : null;
	const oldestCachedTrack = coverCache.keys().next().value;
	if (coverCache.size >= MAX_COVER_CACHE_ENTRIES && oldestCachedTrack) {
		coverCache.delete(oldestCachedTrack);
	}
	coverCache.set(id, { coverId, expiresAt: now + COVER_CACHE_TTL_MS });
	return coverId;
}

/** Test-only reset for the process-local, non-durable artwork cache. */
export function resetArtworkCache(): void {
	coverCache.clear();
}
