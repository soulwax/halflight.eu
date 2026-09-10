import { redisCache, type EphemeralCache } from '#lib/server/cache';
import type { TidalRequestContext } from './client';
import { getTidalConfig } from './config';
import { open, seal } from './crypto';
import { resolveTrackStream, type ResolvedStreamInfo, type TrackAudioQuality } from './stream';

/**
 * Memoises manifest resolution for the playback hot path.
 *
 * `resolveTrackStream` is expensive and was being re-run for *every* request to
 * `/api/tracks/[id]/audio` — so once per seek — and again, independently, by
 * `/api/tracks/[id]/stream`. Each run costs a Postgres read plus an AES-GCM
 * decrypt for the playback token and at least one call to TIDAL's
 * `playbackinfopostpaywall`. Pressing play resolved the same manifest twice.
 *
 * Two tiers plus a single-flight guard:
 *
 * - **L1**, a process-local map. The primary tier under PM2, where one Node
 *   process serves every request.
 * - **L2**, the shared Redis cache, so entries survive `pnpm pm2:reload`.
 * - **Single-flight**, so the concurrent `/stream` + `/audio` pair on track start
 *   collapses into one upstream call rather than racing.
 *
 * Both tiers are fail-open: any cache error degrades to a live resolve.
 *
 * A resolved manifest holds **signed CDN URLs**, which are bearer capabilities.
 * L2 entries are therefore sealed with the same AES-256-GCM key that protects
 * the token rows in Postgres, so nothing readable leaves the process. L1 stays
 * in-process and holds the object as-is.
 */

/**
 * Short by design. The CDN URLs inside a manifest are short-lived signed
 * capabilities, so this only has to span a burst of seeks, not a whole listen.
 * `EphemeralCache` caps TTL at 300s regardless.
 */
const TTL_SECONDS = 120;
const TTL_MS = TTL_SECONDS * 1000;

/** Bounded so a long session cannot grow the process-local tier without limit. */
const MAX_LOCAL_ENTRIES = 64;

/** Track ids that are safe to interpolate into a cache key. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

interface LocalEntry {
	info: ResolvedStreamInfo;
	expiresAt: number;
}

const local = new Map<string, LocalEntry>();
const inFlight = new Map<string, Promise<ResolvedStreamInfo>>();

/** Test seam: drop every memoised manifest and any in-flight resolution. */
export function __resetStreamCache(): void {
	local.clear();
	inFlight.clear();
}

function cacheKey(trackId: string | number, quality: TrackAudioQuality | undefined): string | null {
	const id = String(trackId);
	if (!SAFE_ID.test(id)) return null;
	return `stream:v1:${id}:${quality ?? 'auto'}`;
}

function readLocal(key: string): ResolvedStreamInfo | null {
	const entry = local.get(key);
	if (!entry) return null;
	if (Date.now() >= entry.expiresAt) {
		local.delete(key);
		return null;
	}
	// Refresh insertion order so the map evicts least-recently-used.
	local.delete(key);
	local.set(key, entry);
	return entry.info;
}

function writeLocal(key: string, info: ResolvedStreamInfo): void {
	local.delete(key);
	while (local.size >= MAX_LOCAL_ENTRIES) {
		const oldest = local.keys().next().value;
		if (oldest === undefined) break;
		local.delete(oldest);
	}
	local.set(key, { info, expiresAt: Date.now() + TTL_MS });
}

async function readShared(key: string, cache: EphemeralCache): Promise<ResolvedStreamInfo | null> {
	try {
		const sealed = await cache.get(key);
		if (!sealed) return null;
		return JSON.parse(open(sealed, getTidalConfig().encryptionKey)) as ResolvedStreamInfo;
	} catch {
		// A missing, unreadable, or stale-keyed entry is just a miss.
		return null;
	}
}

async function writeShared(
	key: string,
	info: ResolvedStreamInfo,
	cache: EphemeralCache
): Promise<void> {
	try {
		await cache.set(key, seal(JSON.stringify(info), getTidalConfig().encryptionKey), TTL_SECONDS);
	} catch {
		// Caching is an optimisation; a failure must never fail playback.
	}
}

export interface ResolveTrackStreamCachedOptions {
	quality?: TrackAudioQuality;
	ctx?: TidalRequestContext;
	/** Injectable for tests; defaults to the shared Redis cache. */
	cache?: EphemeralCache;
	/** Injectable for tests; defaults to the live {@link resolveTrackStream}. */
	resolve?: typeof resolveTrackStream;
}

/**
 * {@link resolveTrackStream}, memoised. Concurrent callers for the same track and
 * quality share one upstream resolution.
 */
export async function resolveTrackStreamCached(
	trackId: string | number,
	options: ResolveTrackStreamCachedOptions = {}
): Promise<ResolvedStreamInfo> {
	const { quality, ctx, cache = redisCache, resolve = resolveTrackStream } = options;
	const key = cacheKey(trackId, quality);
	// An id we cannot key safely is never cached — it still resolves normally.
	if (!key) return resolve(trackId, { quality, ctx });

	const hit = readLocal(key);
	if (hit) return hit;

	const existing = inFlight.get(key);
	if (existing) return existing;

	const pending = (async () => {
		const shared = await readShared(key, cache);
		if (shared) {
			writeLocal(key, shared);
			return shared;
		}
		const info = await resolve(trackId, { quality, ctx });
		writeLocal(key, info);
		await writeShared(key, info, cache);
		return info;
	})().finally(() => {
		inFlight.delete(key);
	});

	inFlight.set(key, pending);
	return pending;
}

/**
 * Forget every memoised manifest. Called when the TIDAL connection changes, so a
 * reconnect or a quality change never plays against a manifest signed for the
 * previous session.
 */
export async function invalidateStreamCache(cache: EphemeralCache = redisCache): Promise<void> {
	const keys = [...local.keys()];
	local.clear();
	await Promise.all(
		keys.map(async (key) => {
			try {
				await cache.delete(key);
			} catch {
				// Best effort — the short TTL bounds any entry we fail to drop.
			}
		})
	);
}
