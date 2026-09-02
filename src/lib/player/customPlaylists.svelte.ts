import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { TrackSummary } from '#lib/server/tidal/models';
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
}

const STORAGE_KEY = 'syn_custom_playlists';

export class CustomPlaylistsManager {
	playlists = $state<CustomPlaylist[]>([]);
	isGeneratorOpen = $state(false);
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
					// Index existing local playlists by ID
					const localMap = new SvelteMap(this.playlists.map((p) => [p.id, p]));

					// Merge: server playlists take priority
					for (const serverPl of data.playlists) {
						localMap.set(serverPl.id, serverPl);
					}

					// If there are unsaved local playlists, push them to the server
					const serverIds = new SvelteSet(data.playlists.map((p) => p.id));
					for (const [id, pl] of localMap.entries()) {
						if (!serverIds.has(id)) {
							// Push local playlist to server
							fetch('/api/playlists', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									id: pl.id,
									title: pl.title,
									description: pl.description,
									items: pl.items
								})
							}).catch(() => {});
						}
					}

					this.playlists = Array.from(localMap.values()).sort(
						(a, b) => new SvelteDate(b.updatedAt).getTime() - new SvelteDate(a.updatedAt).getTime()
					);
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
					items: newPlaylist.items
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

	deletePlaylist(playlistId: string): void {
		this.playlists = this.playlists.filter((p) => p.id !== playlistId);
		this.save();

		// Sync delete to server
		if (isBrowser) {
			fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, {
				method: 'DELETE'
			}).catch(() => {});
		}
	}

	playPlaylist(playlistId: string): void {
		const playlist = this.playlists.find((p) => p.id === playlistId);
		if (!playlist || playlist.items.length === 0) return;

		player.play(playlist.items[0], playlist.items);
	}

	openGenerator(): void {
		this.isGeneratorOpen = true;
	}

	closeGenerator(): void {
		this.isGeneratorOpen = false;
	}

	promptAddToPlaylist(track: TrackSummary): void {
		this.selectedTrackForPlaylist = track;
	}

	closeAddToPlaylist(): void {
		this.selectedTrackForPlaylist = null;
	}
}

export const customPlaylists = new CustomPlaylistsManager();
