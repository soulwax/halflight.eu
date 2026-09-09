<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { ArrowDown, ArrowUp, Trash2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
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

	function saveQueue() {
		const tracks = player.currentTrack ? [player.currentTrack, ...player.queue] : [...player.queue];
		if (!tracks.length) return;
		customPlaylists.createPlaylist(
			`${m.player_queue()} — ${new Date().toLocaleDateString()}`,
			m.player_save_queue(),
			tracks
		);
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
		<div class="flex items-center gap-1">
			{#if player.queueCount || player.currentTrack}
				<button type="button" class="min-h-12 px-2 text-sm text-(--action)" onclick={saveQueue}>
					{m.player_save_queue()}
				</button>
			{/if}
			{#if player.queueCount}
				<button
					type="button"
					class="min-h-12 px-2 text-sm text-(--text-muted)"
					onclick={() => player.clearQueue()}
				>
					{m.player_clear_queue()}
				</button>
			{/if}
		</div>
	</div>

	{#if items.length === 0}
		<p class="pt-6 text-center text-(--text-muted)">{m.player_queue_empty()}</p>
	{:else}
		<div
			class="flex-1 divide-y divide-(--border-subtle) overflow-y-auto"
			use:queueDndZone={{ items, flipDurationMs: 150, dropTargetStyle: {} }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each items as entry, i (entry.entryId)}
				<MobileTrackRow track={entry} onActivate={() => player.playFromQueue(entry.entryId)}>
					{#snippet actions()}
						<button
							type="button"
							class="flex h-12 w-12 items-center justify-center text-(--text-muted) disabled:opacity-30"
							disabled={i === 0}
							onclick={(event) => move(entry.entryId, -1, event)}
							aria-label={m.player_move_up()}
						>
							<ArrowUp size={15} />
						</button>
						<button
							type="button"
							class="flex h-12 w-12 items-center justify-center text-(--text-muted) disabled:opacity-30"
							disabled={i === items.length - 1}
							onclick={(event) => move(entry.entryId, 1, event)}
							aria-label={m.player_move_down()}
						>
							<ArrowDown size={15} />
						</button>
						<button
							type="button"
							class="flex h-12 w-12 items-center justify-center text-(--text-muted)"
							onclick={() => player.removeFromQueue(entry.entryId)}
							aria-label={m.player_remove_from_queue()}
						>
							<Trash2 size={15} />
						</button>
					{/snippet}
				</MobileTrackRow>
			{/each}
		</div>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</div>
