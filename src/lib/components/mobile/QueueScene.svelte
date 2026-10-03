<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { ArrowDown, ArrowUp, Trash2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import QueueActions from '#lib/components/player/QueueActions.svelte';
	import SessionSaveStatus from '#lib/components/player/SessionSaveStatus.svelte';
	import { describeQueueMove } from '#lib/player/queue-announce.js';
	import { queueDndZone, type DndEvent } from '#lib/player/queue-dnd.js';
	import type { QueueEntry } from '#lib/player/queue-entry.js';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

	let announcement = $state('');
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

<div class="flex h-full flex-col px-4 py-4">
	<MobileSubScreenHeader
		backHref={resolve('/(mobile)/now')}
		backLabel={m.now_queue_back()}
		heading={m.player_queue()}
		subtitle={player.currentTrack?.title}
	/>

	<div class="flex items-center justify-between border-b border-(--border-subtle) pb-2">
		<span class="text-xs tracking-wide text-(--text-muted) uppercase">{m.player_next_up()}</span>
		<div class="queue-toolbar-actions"><SessionSaveStatus mobile /><QueueActions /></div>
	</div>

	{#if items.length === 0}
		<p class="pt-6 text-center text-(--text-muted)">{m.player_queue_empty()}</p>
	{:else}
		<div
			class="flex-1 divide-y divide-(--border-subtle) overflow-y-auto"
			use:queueDndZone={{ items, flipDurationMs: 150, dropTargetStyle: {}, delayTouchStart: true }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each items as entry, i (entry.entryId)}
				<MobileTrackRow
					compact
					track={entry}
					onActivate={() => player.playFromQueue(entry.entryId)}
				>
					{#snippet actions()}
						<div class="queue-row-controls">
							<button
								type="button"
								class="queue-row-button"
								disabled={i === 0}
								onclick={(event) => move(entry.entryId, -1, event)}
								aria-label={m.player_move_up()}
							>
								<ArrowUp size={14} aria-hidden="true" />
							</button>
							<button
								type="button"
								class="queue-row-button"
								disabled={i === items.length - 1}
								onclick={(event) => move(entry.entryId, 1, event)}
								aria-label={m.player_move_down()}
							>
								<ArrowDown size={14} aria-hidden="true" />
							</button>
							<button
								type="button"
								class="queue-row-button queue-remove"
								onclick={() => player.removeFromQueue(entry.entryId)}
								aria-label={m.player_remove_from_queue()}
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</div>
					{/snippet}
				</MobileTrackRow>
			{/each}
		</div>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</div>

<style>
	.queue-toolbar-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.queue-row-controls {
		display: grid;
		grid-template-columns: repeat(2, 2rem);
		grid-template-rows: repeat(2, 2rem);
		column-gap: 0.125rem;
	}
	.queue-row-button {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.queue-row-button:nth-child(2) {
		grid-column: 1;
		grid-row: 2;
	}
	.queue-remove {
		grid-column: 2;
		grid-row: 1 / 3;
		height: 100%;
	}
	.queue-row-button:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.queue-row-button:hover:not(:disabled) {
		color: var(--action);
	}
	.queue-row-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
</style>
