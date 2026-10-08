import { randomUUID } from 'node:crypto';
import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userPlaylist } from '#lib/server/db/schema';
import { ensurePlaylistTable, type SavedPlaylist } from './index';
import { playlistEditVersion } from './edit-version';
import type { TrackSummary } from '#lib/tidal/models';

/** A short commit transaction: provider requests never hold a database lock. */
export async function saveVerifiedImport(input: {
	userId: string;
	tidalPlaylistId: string;
	title: string;
	description?: string;
	items: TrackSummary[];
	expected: SavedPlaylist | undefined;
}): Promise<{ id: string; status: 'created' | 'synced' | 'conflict' }> {
	await ensurePlaylistTable();
	return db.transaction(async (tx) => {
		// Serializes this owner's source across processes, including the first insert.
		const key = JSON.stringify(['playlist-import', input.userId, input.tidalPlaylistId]);
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
		const [current] = await tx
			.select()
			.from(userPlaylist)
			.where(
				and(
					eq(userPlaylist.userId, input.userId),
					eq(userPlaylist.tidalPlaylistId, input.tidalPlaylistId)
				)
			)
			.orderBy(desc(userPlaylist.updatedAt))
			.limit(1)
			.for('update');
		if (current) {
			const version = playlistEditVersion({
				title: current.title,
				description: current.description,
				items: JSON.parse(current.itemsJson),
				updatedAt: current.updatedAt.toISOString()
			});
			if (
				!input.expected ||
				current.id !== input.expected.id ||
				current.syncStatus === 'local_only' ||
				current.syncStatus === 'pending_push' ||
				version !== playlistEditVersion(input.expected)
			)
				return { id: current.id, status: 'conflict' };
		} else if (input.expected) {
			// A playlist deleted during validation must not reappear.
			return { id: input.expected.id, status: 'conflict' };
		}
		const now = new Date();
		const values = {
			title: input.title.trim() || 'Untitled Playlist',
			description: input.description?.trim() || null,
			itemsJson: JSON.stringify(input.items),
			syncStatus: 'synced',
			lastSyncedAt: now,
			syncError: null,
			updatedAt: now
		};
		if (current) {
			await tx
				.update(userPlaylist)
				.set(values)
				.where(and(eq(userPlaylist.id, current.id), eq(userPlaylist.userId, input.userId)));
			return { id: current.id, status: 'synced' };
		}
		const id = `pl_${randomUUID()}`;
		await tx
			.insert(userPlaylist)
			.values({
				...values,
				id,
				userId: input.userId,
				tidalPlaylistId: input.tidalPlaylistId,
				source: 'tidal',
				createdAt: now
			});
		return { id, status: 'created' };
	});
}
