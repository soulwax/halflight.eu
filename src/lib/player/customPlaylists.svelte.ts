import { SvelteDate } from 'svelte/reactivity';
import { fetchWithinImportBudget } from '#lib/playlists/import-result';
import type { TrackSummary } from '#lib/tidal/models';
import { player } from './player.svelte';

const isBrowser = typeof window !== 'undefined';

export interface CustomPlaylist {
	id: string;
	title: string;
	description?: string | null;
	createdAt: string;
	updatedAt: string;
	items: TrackSummary[];
	tidalPlaylistId?: string | null;
	source?: string;
	syncStatus?: string;
	lastSyncedAt?: string | null;
	remoteEtag?: string | null;
	syncError?: string | null;
}

const STORAGE_KEY = 'syn_custom_playlists';

/**
 * Postgres is the durable source of truth for Halflight playlists. A browser
 * cache can make the first render feel immediate, but it must never restore a
 * playlist the owner already deleted from another tab or device.
 */
export function reconcilePlaylistsWithServer(
	_cachedPlaylists: CustomPlaylist[],
	serverPlaylists: CustomPlaylist[]
): CustomPlaylist[] {
	return [...serverPlaylists].sort(
		(a, b) => new SvelteDate(b.updatedAt).getTime() - new SvelteDate(a.updatedAt).getTime()
	);
}

export class CustomPlaylistsManager {
	playlists = $state<CustomPlaylist[]>([]);
	isImportOpen = $state(false);
	importReviewRequests = $state<{ playlistId: string; source: TrackSummary }[]>([]);
	requestImportReview(result: {
		status?: string;
		playlistId?: string;
		unmatchedTracks?: TrackSummary[];
	}): void {
		if (!result.playlistId || !['created', 'synced'].includes(result.status ?? '')) return;
		for (const source of result.unmatchedTracks ?? []) {
			if (
				source?.kind === 'track' &&
				!this.importReviewRequests.some(
					(request) => request.playlistId === result.playlistId && request.source.id === source.id
				)
			)
				this.importReviewRequests.push({ playlistId: result.playlistId, source });
		}
	}
	selectedTrackForPlaylist = $state<TrackSummary | null>(null);
	isSyncing = $state(false);

	constructor() {
		if (isBrowser) {
			this.load();
			// Background sync with user's account
			this.syncWithServer().catch(() => {});
		}
	}

	load(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					this.playlists = parsed;
				}
			}
		} catch {
			// localStorage disabled or error
		}
	}

	save(): void {
		if (!isBrowser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.playlists));
		} catch {
			// quota exceeded or disabled
		}
	}

	async syncWithServer(): Promise<void> {
		if (!isBrowser) return;
		this.isSyncing = true;
		try {
			const res = await fetch('/api/playlists');
			if (res.ok) {
				const data = (await res.json()) as { playlists: CustomPlaylist[] };
				if (Array.isArray(data.playlists)) {
					this.playlists = reconcilePlaylistsWithServer(this.playlists, data.playlists);
					this.save();
				}
			}
		} catch {
			// Offline or unauthenticated
		} finally {
			this.isSyncing = false;
		}
	}

	createPlaylist(
		title: string,
		description?: string | null,
		initialTracks: TrackSummary[] = [],
		serverRecord?: CustomPlaylist
	): CustomPlaylist {
		const newPlaylist: CustomPlaylist = serverRecord ?? {
			id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
			title: title.trim() || 'Untitled Playlist',
			description: description?.trim() || null,
			createdAt: new SvelteDate().toISOString(),
			updatedAt: new SvelteDate().toISOString(),
			items: [...initialTracks],
			tidalPlaylistId: null
		};

		// Avoid duplicate if server already returned it
		const existingIdx = this.playlists.findIndex((p) => p.id === newPlaylist.id);
		if (existingIdx >= 0) {
			this.playlists[existingIdx] = newPlaylist;
		} else {
			this.playlists.unshift(newPlaylist);
		}
		this.save();

		// If created client-side, persist to server account
		if (!serverRecord && isBrowser) {
			fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: newPlaylist.id,
					title: newPlaylist.title,
					description: newPlaylist.description,
					items: newPlaylist.items,
					syncTidal: false
				})
			})
				.then(async (res) => {
					if (res.ok) {
						const json = (await res.json()) as { playlist: CustomPlaylist };
						if (json.playlist) {
							const idx = this.playlists.findIndex((p) => p.id === newPlaylist.id);
							if (idx >= 0) {
								this.playlists[idx] = json.playlist;
								this.save();
							}
						}
					}
				})
				.catch(() => {});
		}

		return newPlaylist;
	}

	addTrack(playlistId: string, track: TrackSummary): boolean {
		const playlist = this.playlists.find((p) => p.id === playlistId);
		if (!playlist) return false;

		// Don't add duplicate if already present
		if (!playlist.items.some((t) => t.id === track.id)) {
			playlist.items.push(track);
			playlist.updatedAt = new SvelteDate().toISOString();
			this.save();

			// Sync update to server
			if (isBrowser) {
				fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ items: playlist.items })
				}).catch(() => {});
			}
			return true;
		}
		return false;
	}

	removeTrack(playlistId: string, trackId: string): void {
		const playlist = this.playlists.find((p) => p.id === playlistId);
		if (!playlist) return;

		playlist.items = playlist.items.filter((t) => t.id !== trackId);
		playlist.updatedAt = new SvelteDate().toISOString();
		this.save();

		// Sync update to server
		if (isBrowser) {
			fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: playlist.items })
			}).catch(() => {});
		}
	}

	async deletePlaylist(playlistId: string): Promise<boolean> {
		// A deletion is only reflected locally once Postgres has confirmed it. This
		// prevents a failed request from leaving an apparently deleted playlist that
		// returns on the next server sync.
		if (isBrowser) {
			try {
				const response = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, {
					method: 'DELETE'
				});
				// A stale browser may ask to delete a row another tab already removed.
				// There is no remaining server data in that case, so clear its local
				// mirror as well instead of letting the next sync resurrect the card.
				if (!response.ok && response.status !== 404) return false;
			} catch {
				return false;
			}
		}

		this.playlists = this.playlists.filter((p) => p.id !== playlistId);
		this.save();
		return true;
	}

	playPlaylist(playlistId: string): void {
		const playlist = this.playlists.find((p) => p.id === playlistId);
		if (!playlist || playlist.items.length === 0) return;

		player.play(playlist.items[0], playlist.items);
	}

	openImport(): void {
		this.isImportOpen = true;
	}

	closeImport(): void {
		this.isImportOpen = false;
	}

	async syncPlaylist(playlistId: string): Promise<boolean> {
		if (!isBrowser) return false;
		this.isSyncing = true;
		try {
			const playlist = this.playlists.find((item) => item.id === playlistId);
			const pull =
				playlist?.source === 'tidal' &&
				playlist.tidalPlaylistId &&
				playlist.syncStatus !== 'pending_push';
			const res = await fetchWithinImportBudget(
				() =>
					fetch('/api/playlists/sync', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(
							pull
								? { action: 'pull', tidalPlaylistId: playlist.tidalPlaylistId }
								: { action: 'push', playlistId }
						)
					}),
				new AbortController().signal
			);
			if (res.ok) {
				const result = (await res.json()) as {
					status?: string;
					playlistId?: string;
					unmatchedTracks?: TrackSummary[];
				};
				this.requestImportReview(result);
				await this.syncWithServer();
				return result.status === 'synced' || result.status === 'created';
			}
			return false;
		} catch {
			return false;
		} finally {
			this.isSyncing = false;
		}
	}

	async syncAll(): Promise<{ totalSynced: number; totalErrors: number } | null> {
		if (!isBrowser) return null;
		this.isSyncing = true;
		try {
			// First push local changes, then pull remote updates
			const pushRes = await fetchWithinImportBudget(
				() =>
					fetch('/api/playlists/sync', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ action: 'push_all' })
					}),
				new AbortController().signal
			);
			const pullRes = await fetchWithinImportBudget(
				() =>
					fetch('/api/playlists/sync', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ action: 'pull_all' })
					}),
				new AbortController().signal
			);

			await this.syncWithServer();

			const pushData = pushRes.ok ? await pushRes.json() : null;
			const pullData = pullRes.ok ? await pullRes.json() : null;
			for (const result of pullData?.results ?? []) this.requestImportReview(result);

			return {
				totalSynced: (pushData?.totalSynced ?? 0) + (pullData?.totalSynced ?? 0),
				totalErrors: (pushData?.totalErrors ?? 0) + (pullData?.totalErrors ?? 0)
			};
		} catch {
			return null;
		} finally {
			this.isSyncing = false;
		}
	}

	promptAddToPlaylist(track: TrackSummary): void {
		this.selectedTrackForPlaylist = track;
	}

	closeAddToPlaylist(): void {
		this.selectedTrackForPlaylist = null;
	}
}

export const customPlaylists = new CustomPlaylistsManager();
