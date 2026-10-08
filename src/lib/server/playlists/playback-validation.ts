import type { TrackSummary } from '#lib/tidal/models';
import type { TidalRequestContext } from '#lib/server/tidal/client';
import { isTrackUnavailableForPlayback, type TrackAudioQuality } from '#lib/server/tidal/stream';
import { resolveTrackStreamCached } from '#lib/server/tidal/stream-cache';
import {
	getUnplayableTrackIds,
	markTrackUnplayable,
	markTrackPlayable
} from '#lib/server/tidal/track-playability';

const VERIFIED_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFIED_TRACKS = 2_000;
const verified = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();

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
	force: boolean | 'recover' = false
): Promise<TrackSummary[]> {
	const unavailable = force
		? new Set<string>()
		: await getUnplayableTrackIds(tracks.map((track) => track.id));
	const candidates = [...new Map(tracks.map((track) => [track.id, track])).values()];
	for (const track of candidates) {
		ctx.signal?.throwIfAborted();
		if (unavailable.has(track.id)) continue;
		const key = `${ownerId}:${quality}:${track.id}`;
		if (force !== true && (verified.get(key) ?? 0) > Date.now()) continue;
		let request = inFlight.get(key);
		if (!request) {
			request = resolveTrackStreamCached(track.id, {
				userId: ownerId,
				quality,
				ctx
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
}
