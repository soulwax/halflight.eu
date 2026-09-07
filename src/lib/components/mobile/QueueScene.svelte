<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowDown, ArrowUp, Trash2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

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
		<div class="flex items-center gap-3">
			{#if player.queueCount || player.currentTrack}
				<button type="button" class="text-sm text-(--action)" onclick={saveQueue}>
					{m.player_save_queue()}
				</button>
			{/if}
			{#if player.queueCount}
				<button
					type="button"
					class="text-sm text-(--text-muted)"
					onclick={() => player.clearQueue()}
				>
					{m.player_clear_queue()}
				</button>
			{/if}
		</div>
	</div>

	{#if player.queue.length === 0}
		<p class="pt-6 text-center text-(--text-muted)">{m.player_queue_empty()}</p>
	{:else}
		<div class="flex-1 divide-y divide-(--border-subtle) overflow-y-auto">
			{#each player.queue as entry, i (entry.entryId)}
				<MobileTrackRow track={entry} onActivate={() => player.playFromQueue(entry.entryId)}>
					{#snippet actions()}
						<button
							type="button"
							class="flex h-9 w-9 items-center justify-center text-(--text-muted) disabled:opacity-30"
							disabled={i === 0}
							onclick={() => player.moveQueueItem(entry.entryId, -1)}
							aria-label={m.player_move_up()}
						>
							<ArrowUp size={15} />
						</button>
						<button
							type="button"
							class="flex h-9 w-9 items-center justify-center text-(--text-muted) disabled:opacity-30"
							disabled={i === player.queue.length - 1}
							onclick={() => player.moveQueueItem(entry.entryId, 1)}
							aria-label={m.player_move_down()}
						>
							<ArrowDown size={15} />
						</button>
						<button
							type="button"
							class="flex h-9 w-9 items-center justify-center text-(--text-muted)"
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
</div>
