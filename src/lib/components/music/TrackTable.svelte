<script module lang="ts">
	export type TrackColumn = 'album' | 'date' | 'duration';
</script>

<script lang="ts" generics="T extends TrackSummary = TrackSummary">
	import type { Snippet } from 'svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import { queueDndZone, type DndEvent } from '#lib/player/queue-dnd.js';
	import TrackQueueActions from './TrackQueueActions.svelte';
	import TrackTableRow from './TrackTableRow.svelte';

	let {
		tracks,
		contextTracks,
		provenance,
		columns = ['album', 'date', 'duration'],
		rowActions,
		onRowActivate,
		rowKey,
		reorderable = false,
		onconsider,
		onfinalize
	}: {
		tracks: T[];
		contextTracks?: TrackSummary[];
		provenance?: string;
		columns?: TrackColumn[];
		rowActions?: Snippet<[TrackSummary, number]>;
		onRowActivate?: (track: TrackSummary, index: number) => void;
		/**
		 * Stable identity for a row. Defaults to position, which is safe for a
		 * fixed listing but destroys and recreates rows when the list reorders.
		 * Callers that hold a durable id — the queue's entry id, say — should pass
		 * it so Svelte moves the row and keeps focus with it.
		 */
		rowKey?: (track: TrackSummary, index: number) => string;
		reorderable?: boolean;
		onconsider?: (e: CustomEvent<DndEvent<T>>) => void;
		onfinalize?: (e: CustomEvent<DndEvent<T>>) => void;
	} = $props();

	const keyOf = (track: TrackSummary, index: number) =>
		rowKey?.(track, index) ?? `${track.id}-${index}`;

	const cols = $derived({
		album: columns.includes('album'),
		date: columns.includes('date'),
		duration: columns.includes('duration')
	});
	const activeContext = $derived(contextTracks ?? tracks);
	const hasActions = true;
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
			hasActions ? 'auto' : null
		]
			.filter(Boolean)
			.join(' ')
	);
	const narrowGridTemplate = $derived(
		[
			'var(--tt-art-size, 2.75rem)',
			'minmax(0, 1fr)',
			cols.duration ? '3.5rem' : null,
			hasActions ? 'auto' : null
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
		{#if hasActions}<span class="sr-only" role="columnheader">{m.track_col_actions()}</span>{/if}
	</div>

	{#if reorderable}
		<div
			class="tt-body"
			role="rowgroup"
			use:queueDndZone={{
				items: tracks,
				flipDurationMs: 150,
				dropTargetStyle: {},
				delayTouchStart: true
			}}
			{onconsider}
			{onfinalize}
		>
			{#each tracks as track, index (keyOf(track, index))}
				<TrackTableRow
					{track}
					{columns}
					isPlaying={player.currentTrack?.id === track.id}
					onActivate={() => activate(track, index)}
				>
					{#snippet actions()}
						{#if rowActions}
							{@render rowActions(track, index)}
						{:else}
							<TrackQueueActions {track} contextTracks={activeContext} {provenance} />
						{/if}
					{/snippet}
				</TrackTableRow>
			{/each}
		</div>
	{:else}
		<div class="tt-body" role="rowgroup">
			{#each tracks as track, index (keyOf(track, index))}
				<TrackTableRow
					{track}
					{columns}
					isPlaying={player.currentTrack?.id === track.id}
					onActivate={() => activate(track, index)}
				>
					{#snippet actions()}
						{#if rowActions}
							{@render rowActions(track, index)}
						{:else}
							<TrackQueueActions {track} contextTracks={activeContext} {provenance} />
						{/if}
					{/snippet}
				</TrackTableRow>
			{/each}
		</div>
	{/if}
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

	.tt-body {
		display: flex;
		flex-direction: column;
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
