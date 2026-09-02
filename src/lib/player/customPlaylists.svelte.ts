import { SvelteDate } from 'svelte/reactivity';
import type { TrackSummary } from '#lib/server/tidal/models';
import { player } from './player.svelte';

const isBrowser = typeof window !== 'undefined';

export interface CustomPlaylist {
	id: string;
	title: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
	items: TrackSummary[];
}

const STORAGE_KEY = 'syn_custom_playlists';

export class CustomPlaylistsManager {
	playlists = $state<CustomPlaylist[]>([]);
	isGeneratorOpen = $state(false);
	selectedTrackForPlaylist = $state<TrackSummary | null>(null);

	constructor() {
		if (isBrowser) {
			this.load();
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
			// localStorage error or disabled
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

	createPlaylist(
		title: string,
		description?: string,
		initialTracks: TrackSummary[] = []
	): CustomPlaylist {
		const newPlaylist: CustomPlaylist = {
			id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
			title: title.trim() || 'Untitled Playlist',
			description: description?.trim(),
			createdAt: new SvelteDate().toISOString(),
			updatedAt: new SvelteDate().toISOString(),
			items: [...initialTracks]
		};

		this.playlists.unshift(newPlaylist);
		this.save();
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
	}

	deletePlaylist(playlistId: string): void {
		this.playlists = this.playlists.filter((p) => p.id !== playlistId);
		this.save();
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
