<script lang="ts">
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import {
		Disc,
		ListMusic,
		Loader2,
		Pause,
		Play,
		ScrollText,
		SkipBack,
		SkipForward
	} from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	import { haptics } from '#lib/player/haptics.js';

	const track = $derived(player.currentTrack);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');

	// Tied to the track id rather than reset on every change, so a broken image
	// on one track can't keep hiding artwork once playback moves to the next.
	let erroredTrackId = $state<string | null>(null);
	const showFallback = $derived(!cover || erroredTrackId === track?.id);

	// The View Transitions API isn't reachable through layout.css's
	// `transition-duration` reduced-motion rule, so this settle-in fade needs
	// its own guard. One-time, SSR-safe read — matches the `isBrowser` idiom
	// used throughout player.svelte.ts.
	const prefersReducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div class="flex h-full flex-col px-6 py-6">
	<h1 class="sr-only">{m.now_playing_heading()}</h1>

	{#if track}
		<div class="flex justify-end gap-2">
			<a
				href={resolve('/(mobile)/now/lyrics')}
				class="flex h-10 w-10 items-center justify-center text-(--text-primary)"
				aria-label={m.now_lyrics_open()}
			>
				<ScrollText size={20} />
			</a>
			<a
				href={resolve('/(mobile)/now/queue')}
				class="relative flex h-10 w-10 items-center justify-center text-(--text-primary)"
				aria-label={m.now_queue_open()}
			>
				<ListMusic size={20} />
				{#if player.queueCount > 0}
					<span
						class="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--action) px-1 text-[0.6rem] leading-none text-(--action-contrast)"
					>
						{player.queueCount}
					</span>
				{/if}
			</a>
		</div>

		<div class="flex flex-1 flex-col items-center justify-center gap-6">
			{#key track.id}
				<div
					class="aspect-square w-full max-w-sm overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
					style:view-transition-name="syn-now-art"
					transition:fade={{ duration: prefersReducedMotion ? 0 : 200 }}
				>
					{#if !showFallback}
						<img
							src={cover}
							alt={`Cover for ${track.title}`}
							data-track-id={track.id}
							class="h-full w-full object-cover"
							onerror={(event) => {
								const trackId = (event.currentTarget as HTMLImageElement).dataset.trackId;
								if (trackId && player.currentTrack?.id === trackId) erroredTrackId = trackId;
							}}
						/>
					{:else}
						<div class="flex h-full w-full items-center justify-center text-(--text-muted)">
							<Disc size={64} />
						</div>
					{/if}
				</div>
			{/key}

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
					onclick={() => {
						haptics.tick();
						player.previous();
					}}
					aria-label={m.player_previous()}
				>
					<SkipBack size={26} />
				</button>
				<button
					type="button"
					class="flex h-16 w-16 items-center justify-center rounded-full bg-(--action) text-(--action-contrast)"
					onclick={() => {
						haptics.tick();
						player.togglePlayPause();
					}}
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
					onclick={() => {
						haptics.tick();
						player.next();
					}}
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
