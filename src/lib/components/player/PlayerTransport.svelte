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
	let { mobile = false }: { mobile?: boolean } = $props();
	const repeatLabel = $derived(
		player.repeatMode === 'off'
			? m.player_repeat_off()
			: player.repeatMode === 'all'
				? m.player_repeat_all()
				: m.player_repeat_one()
	);
	const playLabel = $derived(
		player.isLoading
			? m.player_loading()
			: player.isPlaying
				? m.player_pause()
				: m.player_play_track()
	);
</script>

<div class="transport" class:mobile>
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
		disabled={!player.canGoPrevious}
		onclick={() => player.previous()}
		title={m.player_previous()}
		aria-label={m.player_previous()}
	>
		<SkipBack size={16} />
	</button>
	<button
		type="button"
		class="t-btn play"
		disabled={!player.currentTrack ||
			player.isLoading ||
			(!player.isPlaying && player.resumeStatus !== 'ready') ||
			player.playbackMode !== 'direct' ||
			player.isPlaybackActiveElsewhere}
		aria-busy={player.isLoading}
		onclick={() => player.togglePlayPause()}
		title={playLabel}
		aria-label={playLabel}
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
		disabled={!player.canGoNext}
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
		aria-pressed={player.repeatMode !== 'off'}
		title={repeatLabel}
		aria-label={repeatLabel}
	>
		<RepeatIcon size={15} />
	</button>
</div>

<style>
	.mobile {
		display: grid;
		width: 100%;
		grid-template-columns: 48px 48px 64px 48px 48px;
		justify-content: space-between;
		align-items: center;
		gap: 0;
	}
	.mobile .t-btn {
		position: relative;
		display: grid;
		width: 48px;
		height: 48px;
		min-width: 48px;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.mobile .play {
		width: 64px;
		height: 64px;
		background: var(--action);
		color: var(--action-contrast);
	}
	.mobile .t-btn.on {
		color: var(--action);
	}
	.mobile .t-btn.on::after {
		content: '';
		position: absolute;
		bottom: 2px;
		width: 4px;
		height: 4px;
		border-radius: var(--radius-full);
		background: currentColor;
	}
	.mobile .t-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mobile .t-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.mobile :global(svg) {
		width: 23px;
		height: 23px;
	}
	.mobile .play :global(svg) {
		width: 28px;
		height: 28px;
	}
</style>
