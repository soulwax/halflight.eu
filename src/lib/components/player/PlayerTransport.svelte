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
		<SkipBack size={16} fill={mobile ? 'currentColor' : 'none'} />
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
		<SkipForward size={16} fill={mobile ? 'currentColor' : 'none'} />
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
		grid-template-columns: 48px 56px 68px 56px 48px;
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
		justify-self: center;
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		touch-action: manipulation;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform var(--dur-fast) ease,
			color var(--dur-fast) ease,
			background-color var(--dur-fast) ease,
			opacity var(--dur-fast) ease;
	}
	/* Previous / next carry more weight than the mode toggles. */
	.mobile .t-btn:nth-child(2),
	.mobile .t-btn:nth-child(4) {
		width: 56px;
		height: 56px;
		color: var(--text-primary);
	}
	.mobile .t-btn:hover:not(:disabled):not(.play) {
		background: color-mix(in oklab, var(--text-primary) 9%, transparent);
	}
	.mobile .t-btn:active:not(:disabled) {
		transform: scale(0.88);
	}
	.mobile .play {
		width: 68px;
		height: 68px;
		background: var(--text-primary);
		color: var(--surface-canvas);
		box-shadow:
			0 10px 28px -8px rgb(0 0 0 / 0.55),
			0 0 0 1px color-mix(in oklab, var(--text-primary) 20%, transparent);
		transition:
			transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow var(--dur-fast) ease,
			opacity var(--dur-fast) ease;
	}
	.mobile .play:hover:not(:disabled) {
		transform: scale(1.04);
	}
	.mobile .play:active:not(:disabled) {
		transform: scale(0.92);
		box-shadow: 0 4px 12px -4px rgb(0 0 0 / 0.45);
	}
	.mobile .t-btn.on {
		color: var(--action);
	}
	.mobile .t-btn.on::after {
		content: '';
		position: absolute;
		bottom: 4px;
		width: 4px;
		height: 4px;
		border-radius: var(--radius-full);
		background: currentColor;
	}
	.mobile .t-btn:disabled {
		opacity: 0.38;
		cursor: default;
	}
	.mobile .t-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.mobile :global(svg) {
		width: 22px;
		height: 22px;
	}
	.mobile .t-btn:nth-child(2) :global(svg),
	.mobile .t-btn:nth-child(4) :global(svg) {
		width: 28px;
		height: 28px;
	}
	.mobile .play :global(svg) {
		width: 30px;
		height: 30px;
	}
	@media (orientation: landscape) and (max-height: 34rem) {
		.mobile {
			grid-template-columns: 48px 48px 60px 48px 48px;
		}
		.mobile .t-btn:nth-child(2),
		.mobile .t-btn:nth-child(4) {
			width: 48px;
			height: 48px;
		}
		.mobile .play {
			width: 60px;
			height: 60px;
		}
	}
</style>
