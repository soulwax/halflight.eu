<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Disc } from '@lucide/svelte';
	import type { TrackSummary } from '#lib/tidal/models';

	let {
		track,
		onActivate,
		actions
	}: {
		track: TrackSummary;
		onActivate: () => void;
		actions?: Snippet;
	} = $props();

	const cover = $derived(track.imageUrl ?? track.album?.imageUrl ?? null);
	const artistLine = $derived(track.artists.map((artist) => artist.name).join(', '));
</script>

<div class="mobile-track-row flex items-center gap-3 py-2">
	<button
		type="button"
		class="flex min-w-0 flex-1 items-center gap-3 text-left"
		onclick={onActivate}
	>
		<span
			class="mobile-track-art flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
		>
			{#if cover}
				<img src={cover} alt="" class="h-full w-full object-cover" />
			{:else}
				<Disc size={16} class="text-(--text-muted)" />
			{/if}
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-sm text-(--text-primary)">{track.title}</span>
			{#if artistLine}
				<span class="block truncate text-xs text-(--text-muted)">{artistLine}</span>
			{/if}
		</span>
	</button>
	{#if actions}
		<div class="flex shrink-0 items-center gap-1">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.mobile-track-row {
		border-radius: var(--radius-md);
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.mobile-track-row:focus-within,
	.mobile-track-row:hover {
		background: color-mix(in oklab, var(--editorial-sky, var(--surface-selected)) 46%, transparent);
	}

	.mobile-track-art {
		border-radius: var(--radius-sm);
	}
</style>
