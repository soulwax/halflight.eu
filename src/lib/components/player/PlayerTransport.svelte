<script lang="ts">
	import {
		Loader2,
		Pause,
		Play,
		Repeat,
		Repeat1,
		Shuffle,
		SkipBack,
		SkipForward
	} from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';

	const RepeatIcon = $derived(player.repeatMode === 'one' ? Repeat1 : Repeat);
</script>

<div class="transport">
	<button
		type="button"
		class="t-btn"
		class:on={player.shuffle}
		onclick={() => player.toggleShuffle()}
		aria-pressed={player.shuffle}
		title={m.player_shuffle()}
		aria-label={m.player_shuffle()}
	>
		<Shuffle size={15} />
	</button>
	<button
		type="button"
		class="t-btn"
		disabled={!player.hasPrevious && player.currentTime < 3}
		onclick={() => player.previous()}
		title={m.player_previous()}
		aria-label={m.player_previous()}
	>
		<SkipBack size={16} />
	</button>
	<button
		type="button"
		class="t-btn play"
		onclick={() => player.togglePlayPause()}
		title={player.isPlaying ? m.player_pause() : m.player_play_track()}
		aria-label={player.isPlaying ? m.player_pause() : m.player_play_track()}
	>
		{#if player.isLoading}
			<Loader2 size={19} class="animate-spin" />
		{:else if player.isPlaying}
			<Pause size={19} fill="currentColor" />
		{:else}
			<Play size={19} fill="currentColor" />
		{/if}
	</button>
	<button
		type="button"
		class="t-btn"
		disabled={!player.hasNext && player.repeatMode === 'off'}
		onclick={() => player.next()}
		title={m.player_next()}
		aria-label={m.player_next()}
	>
		<SkipForward size={16} />
	</button>
	<button
		type="button"
		class="t-btn"
		class:on={player.repeatMode !== 'off'}
		onclick={() => player.cycleRepeat()}
		title={m.player_repeat()}
		aria-label={m.player_repeat()}
	>
		<RepeatIcon size={15} />
	</button>
</div>
