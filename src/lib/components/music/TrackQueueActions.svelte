<script lang="ts">
	import type { TrackSummary } from '#lib/tidal/models';
	import TrackActionMenu from './TrackActionMenu.svelte';

	let {
		track,
		contextTracks,
		provenance
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		provenance?: string;
	} = $props();
</script>

<div class="queue-actions">
	<TrackActionMenu {track} {contextTracks} {provenance} triggerClass="table-row-menu" />
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
