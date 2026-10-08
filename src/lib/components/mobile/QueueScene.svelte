<script lang="ts">
	import { queueEntryActions } from '#lib/context-menu/actions';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { ChevronDown, ChevronUp, Disc, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import QueueActions from '#lib/components/player/QueueActions.svelte';
	import SessionSaveStatus from '#lib/components/player/SessionSaveStatus.svelte';
	import { describeQueueMove } from '#lib/player/queue-announce.js';
	import { queueDndZone, type DndEvent } from '#lib/player/queue-dnd.js';
	import type { QueueEntry } from '#lib/player/queue-entry.js';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';
	import { trackArtworkUrl } from '#lib/tidal/artwork';

	let announcement = $state('');
	const current = $derived(player.currentTrack);
	const currentCover = $derived(trackArtworkUrl(current, 160));
	const currentArtists = $derived(current?.artists.map((artist) => artist.name).join(', ') ?? '');
	let failedCover = $state<string | null>(null);
	let items = $state<QueueEntry[]>([...player.queue]);
	let isDragging = $state(false);

	$effect(() => {
		if (!isDragging) {
			items = [...player.queue];
		}
	});

	function handleConsider(e: CustomEvent<DndEvent<QueueEntry>>) {
		isDragging = true;
		items = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<QueueEntry>>) {
		isDragging = false;
		items = e.detail.items;
		player.reorderQueue(items);
		if (e.detail.info.id) {
			const moved = describeQueueMove(player.queue, e.detail.info.id);
			announcement = moved ? m.player_queue_moved(moved) : '';
		}
	}

	/**
	 * Reorder, say where the entry landed, and keep the keyboard where it was.
	 * The list is keyed by entry id, so the button moves with its row; at either
	 * end that button becomes disabled, so focus goes to the opposite direction.
	 */
	async function move(entryId: string, direction: -1 | 1, event: MouseEvent) {
		const button = event.currentTarget as HTMLButtonElement;
		player.moveQueueItem(entryId, direction);

		const moved = describeQueueMove(player.queue, entryId);
		announcement = moved ? m.player_queue_moved(moved) : '';

		await tick();
		if (!button.isConnected) return;
		if (!button.disabled) {
			button.focus();
			return;
		}
		const sibling = direction === -1 ? button.nextElementSibling : button.previousElementSibling;
		if (sibling instanceof HTMLButtonElement && !sibling.disabled) sibling.focus();
	}
</script>

<section class="queue-scene" aria-labelledby="queue-title">
	<MobileSubScreenHeader
		backHref={resolve('/(mobile)/now')}
		backLabel={m.now_queue_back()}
		heading={m.player_queue()}
		headingId="queue-title"
		dense
	>
		{#snippet actions()}
			<SessionSaveStatus mobile />
			<QueueActions part="save" compact />
		{/snippet}
	</MobileSubScreenHeader>

	{#if current}
		<h2 class="queue-label">{m.player_now_playing()}</h2>
		<a class="queue-now" href={resolve('/(mobile)/now')}>
			<span class="queue-now-art">
				{#if currentCover && currentCover !== failedCover}
					<img
						src={currentCover}
						alt=""
						width="48"
						height="48"
						decoding="async"
						onerror={() => (failedCover = currentCover)}
					/>
				{:else}
					<Disc size={18} aria-hidden="true" />
				{/if}
			</span>
			<span class="queue-now-copy">
				<span class="queue-now-title">{current.title}</span>
				{#if currentArtists}<span class="queue-now-artist">{currentArtists}</span>{/if}
			</span>
			<span class="queue-eq" class:playing={player.isPlaying} aria-hidden="true">
				<i></i><i></i><i></i>
			</span>
		</a>
	{/if}

	<div class="queue-section-head">
		<h2 class="queue-label">{m.player_next_up()}</h2>
		{#if items.length}
			<span class="queue-count">{m.now_queue_count({ count: items.length })}</span>
		{/if}
		<span class="queue-section-action"><QueueActions part="clear" compact /></span>
	</div>

	{#if items.length === 0}
		<p class="queue-empty">{m.player_queue_empty()}</p>
	{:else}
		<div
			class="queue-list"
			use:queueDndZone={{ items, flipDurationMs: 150, dropTargetStyle: {}, delayTouchStart: true }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each items as entry, i (entry.entryId)}
				<MobileTrackRow
					compact
					track={entry}
					onActivate={() => player.playFromQueue(entry.entryId)}
					contextActions={() => queueEntryActions(entry)}
				>
					{#snippet actions()}
						<div class="queue-row-controls">
							<button
								type="button"
								class="queue-row-button queue-remove"
								onclick={() => player.removeFromQueue(entry.entryId)}
								aria-label={m.player_remove_from_queue()}
							>
								<X size={18} aria-hidden="true" />
							</button>
							<!-- Stacked like a reorder handle; long-press anywhere on a row drags it. -->
							<button
								type="button"
								class="queue-row-button queue-move"
								disabled={i === 0}
								onclick={(event) => move(entry.entryId, -1, event)}
								aria-label={m.player_move_up()}
							>
								<ChevronUp size={16} aria-hidden="true" />
							</button>
							<button
								type="button"
								class="queue-row-button queue-move"
								disabled={i === items.length - 1}
								onclick={(event) => move(entry.entryId, 1, event)}
								aria-label={m.player_move_down()}
							>
								<ChevronDown size={16} aria-hidden="true" />
							</button>
						</div>
					{/snippet}
				</MobileTrackRow>
			{/each}
		</div>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</section>

<style>
	.queue-scene {
		display: flex;
		height: 100%;
		flex-direction: column;
		padding: 0.5rem max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
	}

	.queue-label {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	/* The current track, set apart like a pinned row. */
	.queue-now {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.4rem 0 0.9rem;
		padding: 0.5rem;
		border-radius: var(--radius-md);
		background: color-mix(in oklab, var(--action) 9%, var(--surface-raised));
		color: inherit;
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
	}

	.queue-now:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.queue-now-art {
		display: grid;
		width: 3rem;
		height: 3rem;
		flex: none;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: var(--surface-selected);
		color: var(--text-muted);
	}

	.queue-now-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.queue-now-copy {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 0.1rem;
	}

	.queue-now-title,
	.queue-now-artist {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.queue-now-title {
		color: var(--action);
		font-size: var(--fs-base);
		font-weight: 650;
	}

	.queue-now-artist {
		color: var(--text-muted);
		font-size: var(--fs-xs);
	}

	/* A small equaliser that moves only while audio plays. */
	.queue-eq {
		display: flex;
		width: 1rem;
		height: 0.875rem;
		flex: none;
		align-items: flex-end;
		gap: 2px;
		margin-right: 0.25rem;
	}

	/* Staggered even at rest, so it never reads as a "more" menu. */
	.queue-eq i {
		flex: 1;
		height: 45%;
		border-radius: 1px;
		background: var(--action);
	}

	.queue-eq i:nth-child(2) {
		height: 100%;
	}

	.queue-eq i:nth-child(3) {
		height: 70%;
	}

	.queue-eq:not(.playing) {
		opacity: 0.55;
	}

	.queue-eq.playing i {
		animation: queue-eq 0.9s ease-in-out infinite alternate;
	}

	.queue-eq.playing i:nth-child(2) {
		animation-delay: -0.3s;
	}

	.queue-eq.playing i:nth-child(3) {
		animation-delay: -0.6s;
	}

	@keyframes queue-eq {
		from {
			height: 25%;
		}
		to {
			height: 100%;
		}
	}

	.queue-section-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.queue-count {
		color: var(--text-muted);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}

	.queue-section-action {
		margin-left: auto;
		margin-right: -0.25rem;
	}

	.queue-list {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: 0.5rem;
	}

	.queue-empty {
		margin: 0;
		padding-top: 1.5rem;
		color: var(--text-muted);
		text-align: center;
	}

	/* Remove, then a stacked up/down pair: 56px tall, the height of a row. */
	.queue-row-controls {
		display: grid;
		grid-template-columns: 2.5rem 2.25rem;
		grid-template-rows: repeat(2, 1.75rem);
	}

	.queue-row-button {
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.queue-remove {
		grid-column: 1;
		grid-row: 1 / 3;
	}

	.queue-move {
		grid-column: 2;
	}

	.queue-row-button:disabled {
		opacity: 0.25;
		cursor: default;
	}

	.queue-row-button:active:not(:disabled) {
		color: var(--text-primary);
	}

	@media (hover: hover) {
		.queue-row-button:hover:not(:disabled) {
			color: var(--action);
		}
	}

	.queue-row-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.queue-eq.playing i {
			animation: none;
			height: 70%;
		}
	}
</style>
