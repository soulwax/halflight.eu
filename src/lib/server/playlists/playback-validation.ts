import type { TrackSummary } from '#lib/tidal/models';
import type { TidalRequestContext } from '#lib/server/tidal/client';
import { TidalApiError } from '#lib/server/tidal/errors';
import { isTrackUnavailableForPlayback, type TrackAudioQuality } from '#lib/server/tidal/stream';
import { resolveTrackStreamCached } from '#lib/server/tidal/stream-cache';
import {
	getUnplayableTrackIds,
	markTrackUnplayable,
	markTrackPlayable
} from '#lib/server/tidal/track-playability';

const VERIFIED_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFIED_TRACKS = 2_000;
const PROBE_INTERVAL_MS = 1_250;
const verified = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();
let nextProbeAt = 0;
let blockedUntil = 0;

/** Pace import probes only; ordinary playback never waits behind an import. */
async function pacedFetch(
	fetchImpl: typeof fetch,
	...args: Parameters<typeof fetch>
): Promise<Response> {
	if (blockedUntil > Date.now())
		throw new TidalApiError(429, 'Playback validation rate limited', null, 'validation');
	const startAt = Math.max(Date.now(), nextProbeAt);
	nextProbeAt = startAt + PROBE_INTERVAL_MS;
	if (startAt > Date.now())
		await new Promise<void>((resolve) => setTimeout(resolve, startAt - Date.now()));
	if (blockedUntil > Date.now())
		throw new TidalApiError(429, 'Playback validation rate limited', null, 'validation');
	const response = await fetchImpl(...args);
	if (response.status === 429) {
		const seconds = Number(response.headers.get('retry-after'));
		blockedUntil =
			Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : 60_000);
	}
	return response;
}

/**
 * Verify an import before reporting success. Preserve order and duplicate entries;
 * only an asset-specific failure across the quality ladder excludes a recording.
 * Auth, service and rate-limit failures abort validation without hiding tracks.
 */
export async function validatePlaylistPlayback(
	tracks: TrackSummary[],
	ownerId: string,
	ctx: TidalRequestContext,
	quality: TrackAudioQuality,
	force = false
): Promise<TrackSummary[]> {
	const unavailable = force
		? new Set<string>()
		: await getUnplayableTrackIds(tracks.map((track) => track.id));
	const candidates = [...new Map(tracks.map((track) => [track.id, track])).values()];
	for (const track of candidates) {
		if (unavailable.has(track.id)) continue;
		const key = `${ownerId}:${quality}:${track.id}`;
		if (!force && (verified.get(key) ?? 0) > Date.now()) continue;
		let request = inFlight.get(key);
		if (!request) {
			request = resolveTrackStreamCached(track.id, {
				userId: ownerId,
				quality,
				ctx: { ...ctx, fetch: (...args) => pacedFetch(ctx.fetch ?? fetch, ...args) }
			})
				.then(async () => {
					if (force) await markTrackPlayable(track.id);
					if (verified.size >= MAX_VERIFIED_TRACKS) {
						const oldest = verified.keys().next().value;
						if (oldest !== undefined) verified.delete(oldest);
					}
					verified.set(key, Date.now() + VERIFIED_TTL_MS);
				})
				.finally(() => inFlight.delete(key));
			inFlight.set(key, request);
		}
		try {
			await request;
		} catch (cause) {
			if (!isTrackUnavailableForPlayback(cause)) throw cause;
			await markTrackUnplayable(track.id, 'asset not ready for playback');
			unavailable.add(track.id);
		}
	}
	return tracks.filter((track) => !unavailable.has(track.id));
}

/** Test seam; never retains credentials or stream URLs. */
export function resetPlaylistPlaybackValidation(): void {
	verified.clear();
	inFlight.clear();
	nextProbeAt = 0;
	blockedUntil = 0;
}
