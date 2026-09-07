<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Loader2, Pause, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { haptics } from '#lib/player/haptics.js';

	const track = $derived(player.currentTrack);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');

	function togglePlayback() {
		haptics.tick();
		player.togglePlayPause();
	}
</script>

{#if track}
	<div
		class="mobile-mini-player flex h-15 shrink-0 items-center gap-3 border-t border-(--border-subtle) bg-(--surface-raised) px-3"
	>
		<a
			href={resolve('/(mobile)/now')}
			class="flex min-w-0 flex-1 items-center gap-3"
			aria-label={m.now_open_full_player()}
		>
			<span
				class="mobile-mini-art flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
				style:view-transition-name="syn-now-art"
			>
				{#if cover}
					<img src={cover} alt="" class="h-full w-full object-cover" />
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
			class="flex h-10 w-10 shrink-0 items-center justify-center text-(--text-primary)"
			onclick={togglePlayback}
			aria-label={player.isPlaying ? m.player_pause() : m.player_play_track()}
		>
			{#if player.isLoading}
				<Loader2 size={18} class="animate-spin" />
			{:else if player.isPlaying}
				<Pause size={18} fill="currentColor" />
			{:else}
				<Play size={18} fill="currentColor" />
			{/if}
		</button>
	</div>
{/if}

<style>
	.mobile-mini-player {
		min-height: 3.75rem;
		background: color-mix(in oklab, var(--surface-raised) 88%, transparent);
		backdrop-filter: blur(18px) saturate(1.3);
		-webkit-backdrop-filter: blur(18px) saturate(1.3);
	}

	.mobile-mini-art {
		border-radius: var(--radius-sm);
		box-shadow: 0 6px 16px -10px rgb(6 48 100 / 60%);
	}

	@media (prefers-reduced-motion: reduce) {
		.mobile-mini-player {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
</style>
