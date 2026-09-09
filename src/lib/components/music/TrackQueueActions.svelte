<script lang="ts">
	import { ListPlus, ListStart } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import TrackRadioButton from './TrackRadioButton.svelte';
	import TrackActionMenu from './TrackActionMenu.svelte';

	let {
		track,
		provenance
	}: {
		track: TrackSummary;
		provenance?: string;
	} = $props();
</script>

<div class="queue-actions">
	<button
		type="button"
		onclick={() => player.playNext(track, provenance)}
		title={m.player_play_next()}
		aria-label={m.player_play_next()}
	>
		<ListStart size={15} />
	</button>
	<button
		type="button"
		onclick={() => player.addToQueue(track, provenance)}
		title={m.player_add_to_queue()}
		aria-label={m.player_add_to_queue()}
	>
		<ListPlus size={15} />
	</button>
	<TrackRadioButton {track} class="queue-action" />
	<TrackActionMenu {track} {provenance} />
</div>

<style>
	.queue-actions {
		display: flex;
		gap: 0.25rem;
	}

	button {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	button:hover {
		border-color: var(--action);
		color: var(--action);
	}

	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
