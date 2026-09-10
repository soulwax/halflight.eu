import { asc, inArray, lt, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { tidalCacheObject } from '#lib/server/db/schema';

/**
 * A record of every object Syn has written to the HiRes cache bucket.
 *
 * The bucket supports neither `ListObjects` nor lifecycle rules — verified
 * against the live provider, which answers `NoSuchKey` to both — so nothing can
 * enumerate it to find expired objects. Syn therefore has to remember what it
 * wrote. Without this index an object that is never read again after it expires
 * is unreachable and unreclaimable: the cache's own deletion is lazy, happening
 * only when a *read* finds an object already past its expiry.
 *
 * Rows are deliberately thin: an opaque object key (a salted hash of the cache
 * key, not a track id), a size, and a timestamp. No track identity, no URL, no
 * audio.
 */

/** Objects reclaimed per sweep. Bounded so a sweep is always a short operation. */
export const SWEEP_BATCH_SIZE = 50;

export interface CachedObjectRecord {
	objectKey: string;
	expiresAt: Date;
	sizeBytes: number;
}

export interface SegmentCacheIndex {
	record(entry: CachedObjectRecord): Promise<void>;
	/** Expired keys, oldest first, capped at `limit`. */
	claimExpired(now: Date, limit: number): Promise<string[]>;
	forget(objectKeys: string[]): Promise<void>;
}

export const dbSegmentCacheIndex: SegmentCacheIndex = {
	async record({ objectKey, expiresAt, sizeBytes }) {
		await db
			.insert(tidalCacheObject)
			.values({ objectKey, expiresAt, sizeBytes })
			.onConflictDoUpdate({
				target: tidalCacheObject.objectKey,
				set: { expiresAt, sizeBytes, createdAt: sql`now()` }
			});
	},

	async claimExpired(now, limit) {
		const rows = await db
			.select({ objectKey: tidalCacheObject.objectKey })
			.from(tidalCacheObject)
			.where(lt(tidalCacheObject.expiresAt, now))
			.orderBy(asc(tidalCacheObject.expiresAt))
			.limit(limit);
		return rows.map((row) => row.objectKey);
	},

	async forget(objectKeys) {
		if (objectKeys.length === 0) return;
		await db.delete(tidalCacheObject).where(inArray(tidalCacheObject.objectKey, objectKeys));
	}
};
