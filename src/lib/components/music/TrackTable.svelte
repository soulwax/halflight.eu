<script module lang="ts">
	export type TrackColumn = 'album' | 'date' | 'duration';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import TrackTableRow from './TrackTableRow.svelte';

	let {
		tracks,
		contextTracks,
		provenance,
		columns = ['album', 'date', 'duration'],
		rowActions,
		onRowActivate
	}: {
		tracks: TrackSummary[];
		contextTracks?: TrackSummary[];
		provenance?: string;
		columns?: TrackColumn[];
		rowActions?: Snippet<[TrackSummary, number]>;
		onRowActivate?: (track: TrackSummary, index: number) => void;
	} = $props();

	const cols = $derived({
		album: columns.includes('album'),
		date: columns.includes('date'),
		duration: columns.includes('duration')
	});
	const activeContext = $derived(contextTracks ?? tracks);
	const activate = $derived(
		onRowActivate ?? ((track: TrackSummary) => player.play(track, activeContext, provenance))
	);

	const gridTemplate = $derived(
		[
			'var(--tt-art-size, 2.75rem)',
			'minmax(0, 1fr)',
			cols.album ? 'minmax(0, 13rem)' : null,
			cols.date ? '4rem' : null,
			cols.duration ? '3.5rem' : null,
			rowActions ? 'auto' : null
		]
			.filter(Boolean)
			.join(' ')
	);
	const narrowGridTemplate = $derived(
		[
			'var(--tt-art-size, 2.75rem)',
			'minmax(0, 1fr)',
			cols.duration ? '3.5rem' : null,
			rowActions ? 'auto' : null
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div
	class="track-table"
	role="table"
	style:--tt-grid={gridTemplate}
	style:--tt-grid-narrow={narrowGridTemplate}
>
	<div class="tt-head" role="row">
		<span class="sr-only" role="columnheader">{m.track_col_art()}</span>
		<span role="columnheader">{m.track_col_title()}</span>
		{#if cols.album}<span class="tt-hide-narrow" role="columnheader">{m.track_col_album()}</span
			>{/if}
		{#if cols.date}
			<span class="tt-hide-narrow tt-num" role="columnheader">{m.track_col_release()}</span>
		{/if}
		{#if cols.duration}<span class="tt-num" role="columnheader">{m.album_duration()}</span>{/if}
		{#if rowActions}<span class="sr-only" role="columnheader">{m.track_col_actions()}</span>{/if}
	</div>

	{#each tracks as track, index (track.id + '-' + index)}
		<TrackTableRow {track} {columns} onActivate={() => activate(track, index)}>
			{#snippet actions()}
				{@render rowActions?.(track, index)}
			{/snippet}
		</TrackTableRow>
	{/each}
</div>

<style>
	.track-table {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		overflow: hidden;
	}

	.tt-head {
		display: grid;
		grid-template-columns: var(--tt-grid);
		align-items: center;
		gap: 0.85rem;
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid var(--border-strong);
		background: var(--surface-canvas);
		font-family: ui-monospace, monospace;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.tt-head .tt-num {
		text-align: right;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	@container (max-width: 52rem) {
		.tt-head {
			grid-template-columns: var(--tt-grid-narrow);
		}
		.tt-hide-narrow {
			display: none;
		}
	}
</style>
