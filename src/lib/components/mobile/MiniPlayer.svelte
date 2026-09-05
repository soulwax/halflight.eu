<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Loader2, Pause, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';

	const track = $derived(player.currentTrack);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');
</script>

{#if track}
	<div
		class="flex h-14 shrink-0 items-center gap-3 border-t border-(--border-subtle) bg-(--surface-raised) px-3"
	>
		<a
			href={resolve('/(mobile)/now')}
			class="flex min-w-0 flex-1 items-center gap-3"
			aria-label={m.now_open_full_player()}
		>
			<span
				class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
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
			onclick={() => player.togglePlayPause()}
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
