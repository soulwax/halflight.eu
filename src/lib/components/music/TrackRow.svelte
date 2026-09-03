<script lang="ts">
	import { resolve } from '$app/paths';
	import { ListPlus, Play, Plus } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import Badge from '#lib/components/ui/Badge.svelte';
	import type { TrackSummary } from '#lib/server/tidal/models';

	let {
		track,
		contextTracks,
		index,
		showAlbum = false,
		parentArtistName
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		index?: number;
		showAlbum?: boolean;
		parentArtistName?: string;
	} = $props();

	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}

	const hasDistinctArtists = $derived(
		track.artists &&
			track.artists.length > 0 &&
			(!parentArtistName || track.artists.length > 1 || track.artists[0]?.name !== parentArtistName)
	);
</script>

<li class="track-row">
	<button
		type="button"
		class="track-row-play"
		onclick={() => player.play(track, contextTracks)}
		title={m.player_play_track()}
		aria-label={m.player_play_track()}
	>
		<Play size={13} fill="currentColor" />
	</button>

	<span class="track-row-num"
		>{String(track.trackNumber ?? (index !== undefined ? index + 1 : 1)).padStart(2, '0')}</span
	>

	<div class="track-row-main">
		<a class="track-row-title" href={resolve('/app/tracks/[id]', { id: track.id })}>
			<strong>{track.title}</strong>
		</a>
		{#if hasDistinctArtists}
			<span class="track-row-artists">
				{#each track.artists as artist, i (artist.id || i)}
					{#if artist.id}
						<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a>
					{:else}
						<span>{artist.name}</span>
					{/if}{#if i < track.artists.length - 1},
					{/if}
				{/each}
			</span>
		{:else if showAlbum && track.album}
			<span class="track-row-artists">
				<a href={resolve('/app/albums/[id]', { id: track.album.id })}>{track.album.title}</a>
			</span>
		{/if}
	</div>

	{#if track.explicit}
		<Badge variant="explicit" />
	{:else}
		<span></span>
	{/if}

	{#if track.duration}
		<time class="track-row-time">{formatDuration(track.duration)}</time>
	{:else}
		<span></span>
	{/if}

	<div class="flex items-center gap-1.5">
		<button
			type="button"
			class="action-btn p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={() => customPlaylists.promptAddToPlaylist(track)}
			title="Add to Custom Playlist"
			aria-label="Add to Custom Playlist"
		>
			<Plus size={14} />
		</button>
		<button
			type="button"
			class="action-btn p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={() => player.addToQueue(track)}
			title={m.player_add_to_queue()}
			aria-label={m.player_add_to_queue()}
		>
			<ListPlus size={14} />
		</button>
	</div>
</li>

<style>
	.action-btn {
		display: grid;
		place-items: center;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.action-btn:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}
</style>
