<script lang="ts">
	import { ArrowDown, ArrowUp, Trash2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import TrackTable from '#lib/components/music/TrackTable.svelte';

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

<div class="queue-toolbar">
	<span class="q-label">{m.player_next_up()}</span>
	<div class="q-tools">
		{#if player.queueCount || player.currentTrack}
			<button type="button" onclick={saveQueue}>{m.player_save_queue()}</button>
		{/if}
		{#if player.queueCount}
			<button type="button" onclick={() => player.clearQueue()}>{m.player_clear_queue()}</button>
		{/if}
	</div>
</div>

{#if player.queue.length === 0}
	<p class="empty">{m.player_queue_empty()}</p>
{:else}
	<TrackTable
		tracks={player.queue}
		columns={['album', 'date', 'duration']}
		onRowActivate={(_, index) => player.playFromQueue(index)}
	>
		{#snippet rowActions(_track, i)}
			<button
				type="button"
				class="q-row-btn"
				disabled={i === 0}
				onclick={() => player.moveQueueItem(i, -1)}
				aria-label={m.player_move_up()}
			>
				<ArrowUp size={13} />
			</button>
			<button
				type="button"
				class="q-row-btn"
				disabled={i === player.queue.length - 1}
				onclick={() => player.moveQueueItem(i, 1)}
				aria-label={m.player_move_down()}
			>
				<ArrowDown size={13} />
			</button>
			<button
				type="button"
				class="q-row-btn"
				onclick={() => player.removeFromQueue(i)}
				aria-label={m.player_remove_from_queue()}
			>
				<Trash2 size={13} />
			</button>
		{/snippet}
	</TrackTable>
{/if}
