<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Loader2, Pause, Play, SkipForward } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { haptics } from '#lib/player/haptics.js';
	import { trackArtworkUrl } from '#lib/tidal/artwork';

	let { safeArea = false }: { safeArea?: boolean } = $props();
	const track = $derived(player.currentTrack);
	const cover = $derived(trackArtworkUrl(track, 80));
	let failedCover = $state<string | null>(null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');
	const progress = $derived(
		player.duration > 0
			? Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100))
			: 0
	);

	function togglePlayback() {
		haptics.tick();
		if (player.resumeStatus === 'unavailable') player.next();
		else if (player.isPlaybackActiveElsewhere) player.playHere();
		else if (player.playbackMode === 'embed') player.retryPlayback();
		else player.togglePlayPause();
	}
	const playLabel = $derived(
		player.resumeStatus === 'unavailable'
			? m.player_skip_unavailable()
			: player.isLoading
				? m.player_loading()
				: player.isPlaybackActiveElsewhere
					? m.now_play_here()
					: player.playbackMode === 'embed'
						? m.track_retry()
						: player.isPlaying
							? m.player_pause()
							: m.player_play_track()
	);
</script>

{#if track}
	<div
		class:with-safe-area={safeArea}
		class="mobile-mini-player relative flex shrink-0 items-center gap-3 border-t border-(--border-subtle) bg-(--surface-raised) px-3"
	>
		<div class="mini-progress" aria-hidden="true">
			<div class="mini-progress-fill" style:width="{progress}%"></div>
		</div>
		<a
			href={resolve('/(mobile)/now')}
			class="flex min-w-0 flex-1 items-center gap-3"
			aria-label={m.now_open_full_player()}
		>
			<span
				class="mobile-mini-art flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
				style:view-transition-name="syn-now-art"
			>
				{#if cover && cover !== failedCover}
					<img
						src={cover}
						alt=""
						class="h-full w-full object-cover"
						decoding="async"
						onerror={() => (failedCover = cover)}
					/>
				{:else}
					<Disc size={16} class="text-(--text-muted)" />
				{/if}
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm text-(--text-primary)">{track.title}</span>
				{#if artistLine}
					<span class="block truncate text-xs text-(--text-muted)">{artistLine}</span>
				{/if}
			</span>
		</a>
		<button
			type="button"
			class="flex h-12 w-12 shrink-0 items-center justify-center text-(--text-primary)"
			disabled={player.isLoading ||
				player.playbackClaimPending ||
				player.isPlaybackActiveElsewhere ||
				player.playbackMode === 'embed' ||
				(player.resumeStatus !== 'ready' &&
					player.resumeStatus !== 'unavailable' &&
					!player.isPlaying) ||
				player.resumeStatus === 'unavailable' ||
				player.resumeStatus === 'auth' ||
				player.resumeStatus === 'plan' ||
				player.resumeStatus === 'temporary'}
			aria-busy={player.isLoading}
			onclick={togglePlayback}
			aria-label={playLabel}
		>
			{#if player.isLoading}
				<Loader2 size={18} class="animate-spin" />
			{:else if player.isPlaying}
				<Pause size={18} fill="currentColor" />
			{:else}
				<Play size={18} fill="currentColor" />
			{/if}
		</button>
		<button
			type="button"
			class="flex h-12 w-12 shrink-0 items-center justify-center text-(--text-primary) disabled:opacity-40"
			disabled={!player.canGoNext}
			onclick={() => player.next()}
			aria-label={m.player_next()}><SkipForward size={20} aria-hidden="true" /></button
		>
	</div>
{/if}

<style>
	.mobile-mini-player {
		min-height: 3.75rem;
		padding-block: 0.375rem;
		background: color-mix(in oklab, var(--surface-raised) 88%, transparent);
		backdrop-filter: blur(18px) saturate(1.3);
		-webkit-backdrop-filter: blur(18px) saturate(1.3);
	}
	.mobile-mini-player a {
		min-height: 48px;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.mobile-mini-player button {
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.mobile-mini-player button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
		border-radius: var(--radius-full);
	}

	.mobile-mini-art {
		border-radius: var(--radius-sm);
		box-shadow: 0 6px 16px -10px rgb(0 0 0 / 80%);
	}

	.mini-progress {
		position: absolute;
		inset: 0 0 auto;
		height: 2px;
		overflow: hidden;
		background: color-mix(in oklab, var(--border-subtle) 55%, transparent);
	}

	.mini-progress-fill {
		height: 100%;
		background: var(--action);
	}

	@media (prefers-reduced-motion: reduce) {
		.mobile-mini-player {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
	.with-safe-area {
		padding-bottom: calc(0.375rem + env(safe-area-inset-bottom));
	}
</style>
