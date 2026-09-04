<script lang="ts">
	import { Disc } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let { track }: { track: TrackSummary } = $props();

	let imageError = $state(false);
	const cover = $derived(track.imageUrl ?? track.album?.imageUrl ?? null);
</script>

<div class="art-panel">
	<button
		type="button"
		onclick={() => player.togglePlayPause()}
		aria-label={player.isPlaying ? m.player_collapse() : m.player_play_track()}
	>
		{#if cover && !imageError}
			<img src={cover} alt={`Cover for ${track.title}`} onerror={() => (imageError = true)} />
		{:else}
			<span class="art-fallback" aria-hidden="true"><Disc size={48} /></span>
		{/if}
	</button>
</div>
