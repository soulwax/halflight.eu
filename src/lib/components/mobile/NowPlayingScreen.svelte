<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Loader2, Pause, Play, SkipBack, SkipForward } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';

	const track = $derived(player.currentTrack);
	let imageError = $state(false);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');
</script>

<div class="flex h-full flex-col px-6 py-6">
	<h1 class="sr-only">{m.now_playing_heading()}</h1>

	{#if track}
		<div class="flex flex-1 flex-col items-center justify-center gap-6">
			<div
				class="aspect-square w-full max-w-sm overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
			>
				{#if cover && !imageError}
					<img
						src={cover}
						alt={`Cover for ${track.title}`}
						class="h-full w-full object-cover"
						onerror={() => (imageError = true)}
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-(--text-muted)">
						<Disc size={64} />
					</div>
				{/if}
			</div>

			<div class="w-full max-w-sm text-center">
				<p class="truncate text-xl font-semibold text-(--text-primary)">{track.title}</p>
				{#if artistLine}
					<p class="truncate text-sm text-(--text-muted)">{artistLine}</p>
				{/if}
			</div>

			<div class="flex w-full max-w-sm items-center gap-2">
				<span class="w-10 text-right text-xs text-(--text-muted)"
					>{formatClock(player.currentTime)}</span
				>
				<input
					type="range"
					min="0"
					max={player.duration || 100}
					step="0.5"
					value={player.currentTime}
					oninput={(event) => player.seek(parseFloat(event.currentTarget.value))}
					aria-label={m.player_seek()}
					class="h-8 flex-1 accent-(--action)"
				/>
				<span class="w-10 text-xs text-(--text-muted)">{formatClock(player.duration)}</span>
			</div>

			<div class="flex items-center gap-8">
				<button
					type="button"
					class="flex h-12 w-12 items-center justify-center text-(--text-primary) disabled:opacity-40"
					disabled={!player.hasPrevious && player.currentTime < 3}
					onclick={() => player.previous()}
					aria-label={m.player_previous()}
				>
					<SkipBack size={26} />
				</button>
				<button
					type="button"
					class="flex h-16 w-16 items-center justify-center rounded-full bg-(--action) text-(--action-contrast)"
					onclick={() => player.togglePlayPause()}
					aria-label={player.isPlaying ? m.player_pause() : m.player_play_track()}
				>
					{#if player.isLoading}
						<Loader2 size={26} class="animate-spin" />
					{:else if player.isPlaying}
						<Pause size={26} fill="currentColor" />
					{:else}
						<Play size={26} fill="currentColor" />
					{/if}
				</button>
				<button
					type="button"
					class="flex h-12 w-12 items-center justify-center text-(--text-primary) disabled:opacity-40"
					disabled={!player.hasNext && player.repeatMode === 'off'}
					onclick={() => player.next()}
					aria-label={m.player_next()}
				>
					<SkipForward size={26} />
				</button>
			</div>
		</div>
	{:else}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
			<p class="text-(--text-muted)">{m.now_idle_message()}</p>
			<a href={resolve('/(mobile)/home')} class="text-sm text-(--action) underline"
				>{m.now_idle_cta()}</a
			>
		</div>
	{/if}
</div>
