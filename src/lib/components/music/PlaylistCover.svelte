<script lang="ts">
	import { ListMusic } from '@lucide/svelte';
	import type { TrackSummary } from '#lib/tidal/models';
	import { playlistCoverTracks } from '#lib/tidal/playlist-cover';
	import { trackArtworkUrl, type ArtworkSize } from '#lib/tidal/artwork';
	let { tracks, size = 320 }: { tracks: readonly TrackSummary[]; size?: ArtworkSize } = $props();
	const albums = $derived(playlistCoverTracks(tracks));
	const imageSize = $derived<ArtworkSize>(
		albums.length === 4 ? (size === 640 ? 320 : size === 320 ? 160 : 80) : size
	);
	let failed = $state<string[]>([]);
</script>

<div class="playlist-cover" class:collage={albums.length === 4} aria-hidden="true">
	{#if albums.length}{#each albums as track, index (`${track.album?.id ?? track.id}:${index}`)}
			{@const url = trackArtworkUrl(
				track.album ? { ...track, imageUrl: track.album.imageUrl } : track,
				imageSize
			)}
			<span
				>{#if url && !failed.includes(url)}<img
						src={url}
						alt=""
						loading="lazy"
						decoding="async"
						onerror={() => (failed = [...failed, url])}
					/>{:else}<ListMusic size={24} />{/if}</span
			>
		{/each}{:else}<ListMusic size={36} />{/if}
</div>

<style>
	.playlist-cover {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--surface-selected);
		color: var(--text-muted);
		border-radius: inherit;
	}
	.collage {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}
	span {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
