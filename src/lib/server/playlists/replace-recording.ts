import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userPlaylist } from '#lib/server/db/schema';
import type { TrackSummary } from '#lib/tidal/models';

/** Compare-and-swap protects concurrent edits and never changes the TIDAL source. */
export async function replaceSavedRecording(
	userId: string,
	playlistId: string,
	sourceId: string,
	replacement: TrackSummary,
	version: string
): Promise<'updated' | 'missing' | 'conflict'> {
	const [row] = await db
		.select()
		.from(userPlaylist)
		.where(and(eq(userPlaylist.id, playlistId), eq(userPlaylist.userId, userId)))
		.limit(1);
	if (!row) return 'missing';
	if (row.updatedAt.toISOString() !== version) return 'conflict';
	const items = JSON.parse(row.itemsJson) as TrackSummary[];
	if (!items.some((track) => track.id === sourceId)) return 'conflict';
	const updated = items.map((track) =>
		track.id === sourceId ? { ...replacement, replacementForId: sourceId } : track
	);
	const changed = await db
		.update(userPlaylist)
		.set({ itemsJson: JSON.stringify(updated), updatedAt: new Date() })
		.where(
			and(
				eq(userPlaylist.id, playlistId),
				eq(userPlaylist.userId, userId),
				eq(userPlaylist.itemsJson, row.itemsJson)
			)
		)
		.returning({ id: userPlaylist.id });
	return changed.length ? 'updated' : 'conflict';
}
