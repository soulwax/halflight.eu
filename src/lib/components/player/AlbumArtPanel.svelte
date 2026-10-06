<script lang="ts">
	import { Disc } from '@lucide/svelte';
	import type { TrackSummary } from '#lib/tidal/models';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import { m } from '#lib/paraglide/messages.js';

	let { track }: { track: TrackSummary } = $props();

	let failedCover = $state<string | null>(null);
	const cover = $derived(trackArtworkUrl(track));
</script>

<div class="art-panel">
	<div class="artwork-frame">
		{#if cover && failedCover !== cover}
			<img
				src={cover}
				alt={m.player_cover_alt({ title: track.title })}
				fetchpriority="high"
				onerror={() => (failedCover = cover)}
			/>
		{:else}
			<span class="art-fallback" aria-hidden="true"><Disc size={48} /></span>
		{/if}
	</div>
</div>
