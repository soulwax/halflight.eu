<script lang="ts">
	import type { TrackSummary } from '#lib/tidal/models';
	import TrackActionMenu from './TrackActionMenu.svelte';

	let {
		track,
		contextTracks,
		provenance,
		searchQuery,
		onPlayNow
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		provenance?: string;
		searchQuery?: string;
		onPlayNow?: () => void;
	} = $props();
</script>

<div class="queue-actions">
	<TrackActionMenu
		{track}
		{contextTracks}
		{provenance}
		{searchQuery}
		{onPlayNow}
		triggerClass="table-row-menu"
	/>
</div>

<style>
	.queue-actions {
		display: flex;
		align-items: center;
	}

	.queue-actions :global(.table-row-menu) {
		width: 2rem;
		height: 2rem;
	}
</style>
