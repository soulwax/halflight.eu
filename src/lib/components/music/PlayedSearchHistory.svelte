<script lang="ts">
	import { Disc, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { searchHistory, type SearchHistoryEntry } from '#lib/search/history.svelte';
	import { player } from '#lib/player/player.svelte';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	let { mobile = false, onplay }: { mobile?: boolean; onplay?: () => void } = $props();
	let failed = $state<string[]>([]);
	function play(entry: SearchHistoryEntry): void {
		player.playFromSearch(entry.track, [entry.track], entry.query);
		onplay?.();
	}
</script>

<section class="search-history" class:mobile aria-label={m.search_history_title()}>
	<div class="heading">
		<h2>{m.search_history_title()}</h2>
		<button type="button" onclick={() => searchHistory.clear()}>{m.search_history_clear()}</button>
	</div>
	<ul>
		{#each searchHistory.entries as entry (entry.track.id)}
			<li>
				<button class="song" type="button" onclick={() => play(entry)}>
					<span class="artwork">
						{#if trackArtworkUrl(entry.track, 80) && !failed.includes(entry.track.id)}<img
								src={trackArtworkUrl(entry.track, 80) ?? undefined}
								alt=""
								width="40"
								height="40"
								loading="lazy"
								onerror={() => (failed = [...failed, entry.track.id])}
							/>{:else}<Disc size={20} aria-hidden="true" />{/if}
					</span>
					<span class="copy"
						><strong>{entry.track.title}</strong><small
							>{entry.track.artists.map((artist) => artist.name).join(', ')}</small
						></span
					>
				</button>
				<button
					type="button"
					class="remove"
					aria-label={m.search_history_remove({ title: entry.track.title })}
					onclick={() => searchHistory.remove(entry.track.id)}
					><X size={18} aria-hidden="true" /></button
				>
			</li>
		{/each}
	</ul>
</section>

<style>
	.search-history {
		padding: 1rem;
	}
	.mobile {
		padding: 1rem 0;
	}
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
	}
	li {
		display: flex;
		align-items: center;
		min-width: 0;
		border-top: 1px solid var(--border-subtle);
	}
	button {
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		min-height: 3rem;
		cursor: pointer;
	}
	.heading button {
		color: var(--action);
		font-size: 0.875rem;
	}
	.song {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		gap: 0.75rem;
		padding: 0.65rem 0;
		text-align: left;
	}
	.artwork {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface-selected);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}
	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		color: var(--text-muted);
	}
	.remove {
		width: 3rem;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
		border-radius: var(--radius-sm);
	}
</style>
