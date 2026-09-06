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
	<p class="queue-empty">{m.player_queue_empty()}</p>
{:else}
	<TrackTable
		tracks={player.queue}
		columns={['album', 'date', 'duration']}
		onRowActivate={(_, index) => {
			const entry = player.queue[index];
			if (entry) player.playFromQueue(entry.entryId);
		}}
	>
		{#snippet rowActions(_track, i)}
			{@const entryId = player.queue[i]?.entryId}
			<button
				type="button"
				class="q-row-btn"
				disabled={i === 0 || !entryId}
				onclick={() => entryId && player.moveQueueItem(entryId, -1)}
				aria-label={m.player_move_up()}
			>
				<ArrowUp size={13} />
			</button>
			<button
				type="button"
				class="q-row-btn"
				disabled={i === player.queue.length - 1 || !entryId}
				onclick={() => entryId && player.moveQueueItem(entryId, 1)}
				aria-label={m.player_move_down()}
			>
				<ArrowDown size={13} />
			</button>
			<button
				type="button"
				class="q-row-btn"
				onclick={() => entryId && player.removeFromQueue(entryId)}
				aria-label={m.player_remove_from_queue()}
			>
				<Trash2 size={13} />
			</button>
		{/snippet}
	</TrackTable>
{/if}

<style>
	.queue-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.3rem 0.4rem 0.6rem;
	}
	.q-label {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.q-tools {
		display: flex;
		gap: 0.4rem;
	}
	.q-tools button {
		border: 1px solid var(--border-subtle);
		background: transparent;
		padding: 0.25rem 0.6rem;
		color: var(--text-muted);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.q-tools button:hover,
	.q-tools button:focus-visible {
		border-color: var(--accent-gold-deep);
		color: var(--accent-gold);
		outline: none;
	}
	.queue-empty {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.q-row-btn {
		display: grid;
		width: 1.7rem;
		height: 1.7rem;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.q-row-btn:hover:not(:disabled),
	.q-row-btn:focus-visible:not(:disabled) {
		color: var(--accent-gold);
		outline: none;
	}
	.q-row-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	@container (max-width: 24rem) {
		.queue-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
