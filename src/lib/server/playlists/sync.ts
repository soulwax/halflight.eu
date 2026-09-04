import type { Cookies } from '@sveltejs/kit';
import type { PlaylistDetail } from '#lib/tidal/models';
import type { SavedPlaylist } from './index';
import { getUserPlaylists, createUserPlaylist, updateUserPlaylist } from './index';
import { getConnectionStatus, type TidalRequestContext } from '#lib/server/tidal';
import * as tidalApi from '#lib/server/tidal/api';
import {
	addPlaylistItems,
	removePlaylistItems,
	replacePlaylistItems,
	updatePlaylist as updatePlaylistRemote,
	createPlaylist as createPlaylistRemote
} from '#lib/server/tidal/api';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncContext {
	userId: string;
	fetch: typeof fetch;
	cookies: Cookies;
}

export interface SyncResult {
	playlistId: string;
	tidalPlaylistId: string;
	status: 'synced' | 'created' | 'conflict' | 'error' | 'skipped';
	tracksAdded: number;
	tracksRemoved: number;
	error?: string;
}

export interface SyncBatchResult {
	results: SyncResult[];
	totalSynced: number;
	totalErrors: number;
}

export interface PlaylistDiff {
	added: string[];
	removed: string[];
	reordered: boolean;
}

// ─── Pure diff logic ────────────────────────────────────────────────────────

/**
 * Compute the diff between local and remote track ID lists.
 * Pure function — no I/O.
 */
export function diffPlaylistItems(localIds: string[], remoteIds: string[]): PlaylistDiff {
	const localSet = new Set(localIds);
	const remoteSet = new Set(remoteIds);

	const added = localIds.filter((id) => !remoteSet.has(id));
	const removed = remoteIds.filter((id) => !localSet.has(id));

	// Check if the common tracks are in different order
	const commonLocal = localIds.filter((id) => remoteSet.has(id));
	const commonRemote = remoteIds.filter((id) => localSet.has(id));
	const reordered =
		commonLocal.length > 0 &&
		commonLocal.length === commonRemote.length &&
		commonLocal.some((id, i) => id !== commonRemote[i]);

	return { added, removed, reordered };
}

// ─── Pull (TIDAL → Syn) ────────────────────────────────────────────────────

/**
 * Fetch a single TIDAL playlist and upsert it into Postgres.
 * If a local record already exists with this `tidalPlaylistId`, it is updated.
 * Otherwise a new local record is created with `source = 'tidal'`.
 */
export async function pullPlaylist(tidalPlaylistId: string, ctx: SyncContext): Promise<SyncResult> {
	const tidalCtx: TidalRequestContext = { fetch: ctx.fetch, cookies: ctx.cookies };
	const result: SyncResult = {
		playlistId: '',
		tidalPlaylistId,
		status: 'error',
		tracksAdded: 0,
		tracksRemoved: 0
	};

	try {
		// Fetch TIDAL playlist with items included
		const document = await tidalApi.getPlaylist(tidalPlaylistId, { include: ['items'] }, tidalCtx);

		// If the initial fetch didn't include items or was capped at the first page (20 tracks), fetch all items
		let detail: PlaylistDetail | null = normalisePlaylistDetail(document);
		const expectedCount = detail?.numberOfItems ?? 0;
		if (detail && (detail.items.length === 0 || detail.items.length < expectedCount)) {
			const { items, included } = await tidalApi.getFullPlaylistItems(tidalPlaylistId, tidalCtx, {
				include: ['artists', 'albums']
			});
			if (items.length > 0) {
				const relationships =
					(document.data as { relationships?: Record<string, unknown> })?.relationships ?? {};
				// Re-normalise with the full item set
				const fullDoc = {
					...document,
					data: {
						...(document.data as object),
						relationships: {
							...relationships,
							items: {
								...((relationships.items as object) ?? {}),
								data: items
							}
						}
					},
					included: [
						...((document as { included?: unknown[] }).included ?? []),
						...items,
						...included
					]
				};
				detail = normalisePlaylistDetail(fullDoc) ?? detail;
			}
		}

		if (!detail) {
			result.error = 'Failed to normalise TIDAL playlist';
			return result;
		}

		// Find existing local record
		const localPlaylists = await getUserPlaylists(ctx.userId);
		const existing = localPlaylists.find((p) => p.tidalPlaylistId === tidalPlaylistId);

		if (existing) {
			// Update existing local record
			const oldIds = existing.items.map((t) => t.id);
			const newIds = detail.items.map((t) => t.id);
			const diff = diffPlaylistItems(newIds, oldIds);

			await updateUserPlaylist(ctx.userId, existing.id, {
				title: detail.title,
				description: detail.description,
				items: detail.items,
				syncStatus: 'synced',
				lastSyncedAt: new Date(),
				syncError: null
			});

			result.playlistId = existing.id;
			result.status = 'synced';
			result.tracksAdded = diff.added.length;
			result.tracksRemoved = diff.removed.length;
		} else {
			// Create new local record
			const created = await createUserPlaylist({
				userId: ctx.userId,
				title: detail.title,
				description: detail.description,
				items: detail.items,
				tidalPlaylistId,
				source: 'tidal',
				syncStatus: 'synced'
			});

			// Mark as synced immediately
			await updateUserPlaylist(ctx.userId, created.id, {
				lastSyncedAt: new Date(),
				syncStatus: 'synced'
			});

			result.playlistId = created.id;
			result.status = 'created';
			result.tracksAdded = detail.items.length;
		}
	} catch (err) {
		result.error = err instanceof Error ? err.message : 'Unknown error pulling playlist';
	}

	return result;
}

// ─── Push (Syn → TIDAL) ────────────────────────────────────────────────────

const BATCH_SIZE = 50;

/**
 * Push local changes to the linked TIDAL playlist.
 * If no TIDAL playlist exists yet, creates one.
 */
export async function pushPlaylist(
	localPlaylist: SavedPlaylist,
	ctx: SyncContext
): Promise<SyncResult> {
	const tidalCtx: TidalRequestContext = { fetch: ctx.fetch, cookies: ctx.cookies };
	const result: SyncResult = {
		playlistId: localPlaylist.id,
		tidalPlaylistId: localPlaylist.tidalPlaylistId || '',
		status: 'error',
		tracksAdded: 0,
		tracksRemoved: 0
	};

	try {
		let tidalId = localPlaylist.tidalPlaylistId;

		if (!tidalId) {
			// Create new TIDAL playlist
			const doc = await createPlaylistRemote(
				{ name: localPlaylist.title, description: localPlaylist.description || undefined },
				tidalCtx
			);

			// Extract the created playlist ID from the JSON:API response
			const data = (doc as { data?: { id?: string } }).data;
			tidalId = data?.id;
			if (!tidalId) {
				result.error = 'Failed to extract created TIDAL playlist ID';
				return result;
			}

			// Store the TIDAL ID locally
			await updateUserPlaylist(ctx.userId, localPlaylist.id, {
				tidalPlaylistId: tidalId
			});

			result.tidalPlaylistId = tidalId;

			// Add all tracks in batches
			const trackItems = localPlaylist.items.map((t) => ({ id: t.id, type: 'tracks' as const }));
			for (let i = 0; i < trackItems.length; i += BATCH_SIZE) {
				const batch = trackItems.slice(i, i + BATCH_SIZE);
				await addPlaylistItems(tidalId, batch, tidalCtx);
			}

			result.tracksAdded = localPlaylist.items.length;
			result.status = 'created';
		} else {
			// Sync existing playlist: fetch remote state and diff
			let remoteDetail: PlaylistDetail | null = null;
			try {
				const document = await tidalApi.getPlaylist(tidalId, { include: ['items'] }, tidalCtx);
				remoteDetail = normalisePlaylistDetail(document);
				const expectedCount = remoteDetail?.numberOfItems ?? 0;
				if (
					remoteDetail &&
					(remoteDetail.items.length === 0 || remoteDetail.items.length < expectedCount)
				) {
					const { items, included } = await tidalApi.getFullPlaylistItems(tidalId, tidalCtx, {
						include: ['artists', 'albums']
					});
					if (items.length > 0) {
						const relationships =
							(document.data as { relationships?: Record<string, unknown> })?.relationships ?? {};
						const fullDoc = {
							...document,
							data: {
								...(document.data as object),
								relationships: {
									...relationships,
									items: {
										...((relationships.items as object) ?? {}),
										data: items
									}
								}
							},
							included: [
								...((document as { included?: unknown[] }).included ?? []),
								...items,
								...included
							]
						};
						remoteDetail = normalisePlaylistDetail(fullDoc) ?? remoteDetail;
					}
				}
			} catch {
				// Playlist may have been deleted on TIDAL
			}

			if (!remoteDetail) {
				result.error = 'TIDAL playlist not found — it may have been deleted remotely';
				return result;
			}

			// Sync metadata
			const metaChanged =
				localPlaylist.title !== remoteDetail.title ||
				(localPlaylist.description || '') !== (remoteDetail.description || '');
			if (metaChanged) {
				await updatePlaylistRemote(
					tidalId,
					{
						title: localPlaylist.title,
						description: localPlaylist.description || undefined
					},
					tidalCtx
				);
			}

			// Diff tracks
			const localIds = localPlaylist.items.map((t) => t.id);
			const remoteIds = remoteDetail.items.map((t) => t.id);
			const diff = diffPlaylistItems(localIds, remoteIds);

			// Use replace if reordered or if there are both additions and removals
			if (diff.reordered || (diff.added.length > 0 && diff.removed.length > 0)) {
				const allItems = localIds.map((id) => ({ id, type: 'tracks' as const }));
				await replacePlaylistItems(tidalId, allItems, tidalCtx);
			} else {
				// Remove tracks
				if (diff.removed.length > 0) {
					const removeItems = diff.removed.map((id) => ({ id, type: 'tracks' as const }));
					await removePlaylistItems(tidalId, removeItems, tidalCtx);
				}

				// Add tracks in batches
				if (diff.added.length > 0) {
					const addItems = diff.added.map((id) => ({ id, type: 'tracks' as const }));
					for (let i = 0; i < addItems.length; i += BATCH_SIZE) {
						const batch = addItems.slice(i, i + BATCH_SIZE);
						await addPlaylistItems(tidalId, batch, tidalCtx);
					}
				}
			}

			result.tracksAdded = diff.added.length;
			result.tracksRemoved = diff.removed.length;
			result.status = 'synced';
		}

		// Update sync state
		await updateUserPlaylist(ctx.userId, localPlaylist.id, {
			syncStatus: 'synced',
			lastSyncedAt: new Date(),
			syncError: null
		});
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error pushing playlist';
		result.error = errorMessage;

		// Mark error state in DB
		try {
			await updateUserPlaylist(ctx.userId, localPlaylist.id, {
				syncStatus: 'error',
				syncError: errorMessage
			});
		} catch {
			// Best-effort
		}
	}

	return result;
}

// ─── Batch operations ───────────────────────────────────────────────────────

/**
 * Pull all owner playlists from TIDAL that are already imported (linked).
 */
export async function pullAllPlaylists(ctx: SyncContext): Promise<SyncBatchResult> {
	const results: SyncResult[] = [];

	const localPlaylists = await getUserPlaylists(ctx.userId);
	const linkedPlaylists = localPlaylists.filter((p) => p.tidalPlaylistId);

	for (const playlist of linkedPlaylists) {
		const res = await pullPlaylist(playlist.tidalPlaylistId!, ctx);
		results.push(res);
	}

	return {
		results,
		totalSynced: results.filter((r) => r.status === 'synced' || r.status === 'created').length,
		totalErrors: results.filter((r) => r.status === 'error').length
	};
}

/**
 * Push all locally modified playlists that have a TIDAL link (or are source=syn
 * and have pending changes).
 */
export async function pushAllPlaylists(ctx: SyncContext): Promise<SyncBatchResult> {
	const results: SyncResult[] = [];

	const localPlaylists = await getUserPlaylists(ctx.userId);
	const pushable = localPlaylists.filter(
		(p) =>
			p.tidalPlaylistId ||
			(p.source === 'syn' && p.syncStatus !== 'synced' && p.syncStatus !== 'local_only')
	);

	for (const playlist of pushable) {
		const res = await pushPlaylist(playlist, ctx);
		results.push(res);
	}

	return {
		results,
		totalSynced: results.filter((r) => r.status === 'synced' || r.status === 'created').length,
		totalErrors: results.filter((r) => r.status === 'error').length
	};
}

/**
 * List the owner's TIDAL playlists available for import.
 * Returns PlaylistSummary[] with an `isImported` flag.
 */
export async function listImportablePlaylists(ctx: SyncContext) {
	const tidalCtx: TidalRequestContext = { fetch: ctx.fetch, cookies: ctx.cookies };

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return { playlists: [], error: 'TIDAL not connected' };
	}

	try {
		const { items, included } = await tidalApi.getFullCollection('playlists', tidalCtx);
		const { normalisePlaylist } = await import('#lib/server/tidal/normalise');

		// Get already-imported TIDAL IDs
		const localPlaylists = await getUserPlaylists(ctx.userId);
		const importedTidalIds = new Set(
			localPlaylists.filter((p) => p.tidalPlaylistId).map((p) => p.tidalPlaylistId!)
		);

		const playlists = (items as Array<{ id: string; type: string }>)
			.map((item: { id: string; type: string }) => {
				const resolved =
					(included as Array<{ id?: string; type?: string }> | undefined)?.find(
						(inc: { id?: string; type?: string }) => inc.id === item.id && inc.type === item.type
					) ?? item;
				return normalisePlaylist(resolved as never);
			})
			.filter(Boolean)
			.map((p) => ({
				...p!,
				isImported: importedTidalIds.has(p!.id)
			}));

		return { playlists, error: null };
	} catch (err) {
		return {
			playlists: [],
			error: err instanceof Error ? err.message : 'Failed to list TIDAL playlists'
		};
	}
}
