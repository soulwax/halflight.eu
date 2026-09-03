<script lang="ts">
	import TrackRow from './TrackRow.svelte';
	import type { TrackSummary } from '#lib/server/tidal/models';

	let {
		tracks,
		contextTracks,
		showAlbum = false,
		parentArtistName
	}: {
		tracks: TrackSummary[];
		contextTracks?: TrackSummary[];
		showAlbum?: boolean;
		parentArtistName?: string;
	} = $props();

	const activeContext = $derived(contextTracks ?? tracks);
</script>

<ol class="track-list">
	{#each tracks as track, index (track.id || index)}
		<TrackRow {track} contextTracks={activeContext} {index} {showAlbum} {parentArtistName} />
	{/each}
</ol>

<style>
	.track-list {
		display: flex;
		flex-direction: column;
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		overflow: hidden;
	}
</style>
