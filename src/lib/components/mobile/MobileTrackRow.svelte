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

<div class="mobile-track-row">
	<button type="button" class="mobile-track-primary" onclick={onActivate}>
		<span class="mobile-track-art">
			{#if cover}
				<img src={cover} alt="" loading="lazy" width="44" height="44" />
			{:else}
				<Disc size={16} aria-hidden="true" />
			{/if}
		</span>
		<span class="mobile-track-copy">
			<span class="mobile-track-title">{track.title}</span>
			{#if artistLine}
				<span class="mobile-track-artist">{artistLine}</span>
			{/if}
		</span>
	</button>
	{#if actions}
		<div class="mobile-track-actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.mobile-track-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 4rem;
		padding: 0.375rem;
		border-radius: var(--radius-md);
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.mobile-track-row:focus-within,
	.mobile-track-row:hover {
		background: color-mix(in oklab, var(--editorial-sky, var(--surface-selected)) 46%, transparent);
	}

	.mobile-track-art {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: none;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-selected);
		color: var(--text-muted);
	}

	.mobile-track-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mobile-track-primary {
		display: flex;
		min-width: 0;
		min-height: 3rem;
		flex: 1;
		align-items: center;
		gap: 0.75rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.mobile-track-copy {
		min-width: 0;
		flex: 1;
	}

	.mobile-track-title,
	.mobile-track-artist {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mobile-track-title {
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.mobile-track-artist {
		margin-top: 0.14rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		line-height: 1.3;
	}

	.mobile-track-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
	}

	.mobile-track-primary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
