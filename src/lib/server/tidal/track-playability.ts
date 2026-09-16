import { inArray } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { trackPlayability } from '#lib/server/db/schema';
import { log } from '#lib/server/log';

/**
 * Process-local mirror of the `track_playability` table's key set.
 *
 * One fork-mode PM2 process serves every request (see `MASTERPLAN.md`), so an
 * in-memory set is already consistent for the whole app — there is no second
 * process to fall out of sync with. It exists purely to skip a Postgres round
 * trip for ids a track listing has already resolved this process's lifetime;
 * losing it on `pnpm pm2:reload` just means the next filter re-reads Postgres,
 * which is one indexed lookup and never wrong.
 */
const MAX_LOCAL_ENTRIES = 5_000;
const local = new Set<string>();

function rememberLocal(trackId: string): void {
	if (local.has(trackId)) return;
	if (local.size >= MAX_LOCAL_ENTRIES) {
		const oldest = local.values().next().value;
		if (oldest !== undefined) local.delete(oldest);
	}
	local.add(trackId);
}

/** Test seam: drop every memoised unplayable id. */
export function __resetTrackPlayabilityCache(): void {
	local.clear();
}

/**
 * Record that `trackId` failed to resolve a playable stream at every quality
 * TIDAL offered. Called from the stream-resolution routes' failure path —
 * never proactively — so a row only ever reflects an actual attempted, failed
 * play. Idempotent: a track already marked unplayable just gets a fresh
 * `checkedAt`.
 */
export async function markTrackUnplayable(trackId: string, reason: string): Promise<void> {
	rememberLocal(trackId);
	try {
		await db
			.insert(trackPlayability)
			.values({ trackId, reason, checkedAt: new Date() })
			.onConflictDoUpdate({
				target: trackPlayability.trackId,
				set: { reason, checkedAt: new Date() }
			});
	} catch (err) {
		// The in-memory record above still hides the track for this process even
		// if the write itself fails — a missed row just means the next process
		// restart re-checks it, which is the same lazy behaviour as never having
		// played it before.
		log.error('track-playability: failed to record unplayable track', { trackId, cause: err });
	}
}

/**
 * Which of the given track ids are known unplayable, checking the process
 * cache first and Postgres only for ids it has not seen yet.
 */
export async function getUnplayableTrackIds(trackIds: readonly string[]): Promise<Set<string>> {
	const ids = [...new Set(trackIds.filter((id) => id.length > 0))];
	if (ids.length === 0) return new Set();

	const unplayable = new Set<string>();
	const unknown: string[] = [];
	for (const id of ids) {
		if (local.has(id)) unplayable.add(id);
		else unknown.push(id);
	}
	if (unknown.length === 0) return unplayable;

	try {
		const rows = await db
			.select({ trackId: trackPlayability.trackId })
			.from(trackPlayability)
			.where(inArray(trackPlayability.trackId, unknown));
		for (const row of rows) {
			rememberLocal(row.trackId);
			unplayable.add(row.trackId);
		}
	} catch (err) {
		// A read failure must never hide tracks that were never actually
		// confirmed unplayable — fall back to showing everything.
		log.error('track-playability: batch read failed', { cause: err });
	}
	return unplayable;
}

/**
 * Drop tracks already confirmed unplayable from a list before it reaches a
 * page or API response. Safe on any track-shaped list — playlist items, album
 * tracks, search results, taste-generated candidates.
 */
export async function filterPlayableTracks<T extends { id: string }>(tracks: T[]): Promise<T[]> {
	if (tracks.length === 0) return tracks;
	const unplayable = await getUnplayableTrackIds(tracks.map((track) => track.id));
	if (unplayable.size === 0) return tracks;
	return tracks.filter((track) => !unplayable.has(track.id));
}
