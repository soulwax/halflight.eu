import { db } from '#lib/server/db';
import { userPlaylist } from '#lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { TrackSummary } from '#lib/tidal/models';
import { log } from '#lib/server/log';
import { readRecord } from '#lib/server/tidal/store';
import { getAccessToken, type TidalRequestContext } from '#lib/server/tidal/client';

export interface SavedPlaylist {
	id: string;
	userId: string;
	title: string;
	description?: string | null;
	items: TrackSummary[];
	tidalPlaylistId?: string | null;
	createdAt: string;
	updatedAt: string;
	source: string;
	syncStatus: string;
	lastSyncedAt?: string | null;
	remoteEtag?: string | null;
	syncError?: string | null;
}

let tableInitPromise: Promise<void> | null = null;

/**
 * Ensure the `user_playlist` table exists in PostgreSQL.
 * Safe to call concurrently; runs only once per server lifetime.
 */
export async function ensurePlaylistTable(): Promise<void> {
	if (!tableInitPromise) {
		tableInitPromise = (async () => {
			try {
				await db.execute(sql`
					CREATE TABLE IF NOT EXISTS user_playlist (
						id TEXT PRIMARY KEY,
						user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
						title TEXT NOT NULL,
						description TEXT,
						items_json TEXT NOT NULL DEFAULT '[]',
						tidal_playlist_id TEXT,
						created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
						updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
						source TEXT NOT NULL DEFAULT 'syn',
						sync_status TEXT NOT NULL DEFAULT 'local_only',
						last_synced_at TIMESTAMP WITH TIME ZONE,
						remote_etag TEXT,
						sync_error TEXT
					);
					CREATE INDEX IF NOT EXISTS user_playlist_user_id_idx ON user_playlist(user_id);
				`);
			} catch (err) {
				log.error('failed to ensure user_playlist table', { cause: err });
			}
		})();
	}
	await tableInitPromise;
}

function parseItemsJson(jsonStr: string): TrackSummary[] {
	try {
		return JSON.parse(jsonStr) as TrackSummary[];
	} catch {
		return [];
	}
}

export async function getUserPlaylists(userId: string): Promise<SavedPlaylist[]> {
	await ensurePlaylistTable();
	const rows = await db
		.select()
		.from(userPlaylist)
		.where(eq(userPlaylist.userId, userId))
		.orderBy(desc(userPlaylist.updatedAt));

	return rows.map((r) => ({
		id: r.id,
		userId: r.userId,
		title: r.title,
		description: r.description,
		items: parseItemsJson(r.itemsJson),
		tidalPlaylistId: r.tidalPlaylistId,
		createdAt: r.createdAt.toISOString(),
		updatedAt: r.updatedAt.toISOString(),
		source: r.source,
		syncStatus: r.syncStatus,
		lastSyncedAt: r.lastSyncedAt?.toISOString() || null,
		remoteEtag: r.remoteEtag,
		syncError: r.syncError
	}));
}

export async function createUserPlaylist(data: {
	id?: string;
	userId: string;
	title: string;
	description?: string;
	items: TrackSummary[];
	tidalPlaylistId?: string;
	source?: string;
	syncStatus?: string;
}): Promise<SavedPlaylist> {
	await ensurePlaylistTable();
	const id = data.id || `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
	const now = new Date();
	const itemsJson = JSON.stringify(data.items);

	await db.insert(userPlaylist).values({
		id,
		userId: data.userId,
		title: data.title.trim() || 'Untitled Playlist',
		description: data.description?.trim() || null,
		itemsJson,
		tidalPlaylistId: data.tidalPlaylistId || null,
		createdAt: now,
		updatedAt: now,
		source: data.source || 'syn',
		syncStatus: data.syncStatus || 'local_only'
	});

	return {
		id,
		userId: data.userId,
		title: data.title.trim() || 'Untitled Playlist',
		description: data.description?.trim() || null,
		items: data.items,
		tidalPlaylistId: data.tidalPlaylistId || null,
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
		source: data.source || 'syn',
		syncStatus: data.syncStatus || 'local_only',
		lastSyncedAt: null,
		remoteEtag: null,
		syncError: null
	};
}

export async function updateUserPlaylist(
	userId: string,
	playlistId: string,
	updates: {
		title?: string;
		description?: string;
		items?: TrackSummary[];
		tidalPlaylistId?: string;
		syncStatus?: string;
		lastSyncedAt?: Date | null;
		remoteEtag?: string | null;
		syncError?: string | null;
	}
): Promise<SavedPlaylist | null> {
	await ensurePlaylistTable();
	const existing = await db
		.select()
		.from(userPlaylist)
		.where(and(eq(userPlaylist.id, playlistId), eq(userPlaylist.userId, userId)))
		.limit(1);

	if (!existing.length) return null;

	const valuesToUpdate: Record<string, unknown> = {
		updatedAt: new Date()
	};

	if (updates.title !== undefined)
		valuesToUpdate.title = updates.title.trim() || 'Untitled Playlist';
	if (updates.description !== undefined)
		valuesToUpdate.description = updates.description?.trim() || null;
	if (updates.items !== undefined) valuesToUpdate.itemsJson = JSON.stringify(updates.items);
	if (updates.tidalPlaylistId !== undefined)
		valuesToUpdate.tidalPlaylistId = updates.tidalPlaylistId || null;
	if (updates.syncStatus !== undefined) valuesToUpdate.syncStatus = updates.syncStatus;
	if (updates.lastSyncedAt !== undefined) valuesToUpdate.lastSyncedAt = updates.lastSyncedAt;
	if (updates.remoteEtag !== undefined) valuesToUpdate.remoteEtag = updates.remoteEtag;
	if (updates.syncError !== undefined) valuesToUpdate.syncError = updates.syncError;

	await db
		.update(userPlaylist)
		.set(valuesToUpdate)
		.where(and(eq(userPlaylist.id, playlistId), eq(userPlaylist.userId, userId)));

	const updated = await db
		.select()
		.from(userPlaylist)
		.where(and(eq(userPlaylist.id, playlistId), eq(userPlaylist.userId, userId)))
		.limit(1);

	if (!updated.length) return null;

	const r = updated[0];
	return {
		id: r.id,
		userId: r.userId,
		title: r.title,
		description: r.description,
		items: parseItemsJson(r.itemsJson),
		tidalPlaylistId: r.tidalPlaylistId,
		createdAt: r.createdAt.toISOString(),
		updatedAt: r.updatedAt.toISOString(),
		source: r.source,
		syncStatus: r.syncStatus,
		lastSyncedAt: r.lastSyncedAt?.toISOString() || null,
		remoteEtag: r.remoteEtag,
		syncError: r.syncError
	};
}

export async function deleteUserPlaylist(userId: string, playlistId: string): Promise<boolean> {
	await ensurePlaylistTable();
	await db
		.delete(userPlaylist)
		.where(and(eq(userPlaylist.id, playlistId), eq(userPlaylist.userId, userId)));
	return true;
}

/**
 * Attempt to export / create the playlist in the connected TIDAL user account.
 * Silently catches and returns null if TIDAL account is disconnected, scopes are
 * read-only, or endpoint returns an error.
 *
 * @deprecated Use the background playlist sync worker instead.
 */
export async function attemptTidalPlaylistSync(
	title: string,
	description: string | undefined,
	trackIds: string[],
	ctx: TidalRequestContext = {}
): Promise<string | null> {
	try {
		const tokenRecord = await readRecord(ctx.store);
		if (!tokenRecord || !tokenRecord.userId) return null;

		const accessToken = await getAccessToken(ctx);
		const fetchFn = ctx.fetch ?? fetch;

		// 1. Create playlist on TIDAL v1
		const createRes = await fetchFn(
			`https://api.tidal.com/v1/users/${encodeURIComponent(tokenRecord.userId)}/playlists`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({
					title: title.slice(0, 100),
					description: (description || '').slice(0, 250)
				}).toString()
			}
		);

		if (!createRes.ok) return null;
		const createdJson = (await createRes.json()) as { uuid?: string; id?: string };
		const playlistUuid = createdJson.uuid || createdJson.id;
		if (!playlistUuid) return null;

		// 2. Add tracks if we have track IDs (chunked to 50 per TIDAL v1 API limit)
		if (trackIds.length > 0) {
			const validIds = trackIds.filter(Boolean);
			for (let i = 0; i < validIds.length; i += 50) {
				const batch = validIds.slice(i, i + 50);
				if (batch.length > 0) {
					await fetchFn(
						`https://api.tidal.com/v1/playlists/${encodeURIComponent(playlistUuid)}/items`,
						{
							method: 'POST',
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/x-www-form-urlencoded',
								'If-None-Match': '*'
							},
							body: new URLSearchParams({
								trackIds: batch.join(',')
							}).toString()
						}
					).catch(() => null);
				}
			}
		}

		return playlistUuid;
	} catch {
		// Non-fatal: TIDAL cloud sync is an optional enhancement
		return null;
	}
}
