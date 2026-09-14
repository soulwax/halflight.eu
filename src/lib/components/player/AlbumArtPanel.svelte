<script lang="ts">
	import { Disc } from '@lucide/svelte';
	import type { TrackSummary } from '#lib/tidal/models';

	let { track }: { track: TrackSummary } = $props();

	let imageError = $state(false);
	const cover = $derived(track.imageUrl ?? track.album?.imageUrl ?? null);
</script>

<div class="art-panel">
	<div class="artwork-frame">
		{#if cover && !imageError}
			<img src={cover} alt={`Cover for ${track.title}`} onerror={() => (imageError = true)} />
		{:else}
			<span class="art-fallback" aria-hidden="true"><Disc size={48} /></span>
		{/if}
	</div>
</div>
