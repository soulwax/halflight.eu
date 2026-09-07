<script lang="ts">
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import {
		BadgeInfo,
		ChevronDown,
		Disc,
		ListMusic,
		Loader2,
		Pause,
		Play,
		Repeat,
		Repeat1,
		ScrollText,
		Shuffle,
		SkipBack,
		SkipForward
	} from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock, formatReleaseDate } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	import { haptics } from '#lib/player/haptics.js';

	const track = $derived(player.currentTrack);
	const RepeatIcon = $derived(player.repeatMode === 'one' ? Repeat1 : Repeat);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');
	const releaseYear = $derived(formatReleaseDate(track?.album?.releaseDate));
	const albumLine = $derived(
		track?.album ? `${track.album.title}${releaseYear ? ` · ${releaseYear}` : ''}` : ''
	);
	let scrubTime = $state<number | null>(null);
	const displayedTime = $derived(scrubTime ?? player.currentTime);

	// A scrub preview belongs to the track being touched. If playback advances
	// before the pointer is released, discard the stale preview rather than
	// rendering or committing its position against the next track.
	const trackId = $derived(track?.id);
	$effect(() => {
		void trackId;
		scrubTime = null;
	});

	function previewSeek(event: Event): void {
		const next = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(next)) scrubTime = next;
	}

	function commitSeek(event: Event): void {
		const next = Number((event.currentTarget as HTMLInputElement).value);
		scrubTime = null;
		if (!Number.isFinite(next)) return;
		haptics.tick();
		player.seek(next);
	}

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
		<div class="flex items-center justify-between gap-2">
			<a
				href={resolve('/(mobile)/home')}
				class="flex h-12 w-12 items-center justify-center text-(--text-primary)"
				aria-label={m.now_close_player()}
			>
				<ChevronDown size={24} aria-hidden="true" />
			</a>
			<div class="flex gap-2">
				<a
					href={resolve('/(mobile)/now/lyrics')}
					class="flex h-12 w-12 items-center justify-center text-(--text-primary)"
					aria-label={m.now_lyrics_open()}
				>
					<ScrollText size={20} />
				</a>
				<a
					href={resolve('/(mobile)/now/credits')}
					class="flex h-12 w-12 items-center justify-center text-(--text-primary)"
					aria-label={m.now_credits_open()}><BadgeInfo size={20} /></a
				>
				<a
					href={resolve('/(mobile)/now/queue')}
					class="relative flex h-12 w-12 items-center justify-center text-(--text-primary)"
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
		</div>

		<div class="flex flex-1 flex-col items-center justify-center gap-6">
			{#key track.id}
				<div
					class="now-artwork aspect-square w-full max-w-sm overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
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
				{#if albumLine}
					<p class="truncate text-sm text-(--text-muted)">{albumLine}</p>
				{/if}
				{#if track.provenance || player.qualityLabel}
					<p class="mt-2 text-xs text-(--text-muted)">
						{[track.provenance, player.qualityLabel].filter(Boolean).join(' · ')}
					</p>
				{/if}
			</div>

			<div class="flex w-full max-w-sm items-center gap-2">
				<span class="w-10 text-right text-xs text-(--text-muted)">{formatClock(displayedTime)}</span
				>
				<input
					type="range"
					min="0"
					max={player.duration || 100}
					step="0.5"
					value={displayedTime}
					oninput={previewSeek}
					onchange={commitSeek}
					onpointercancel={() => (scrubTime = null)}
					aria-label={m.player_seek()}
					aria-valuetext={formatClock(displayedTime)}
					class="h-8 flex-1 accent-(--action)"
				/>
				<span class="w-10 text-xs text-(--text-muted)">{formatClock(player.duration)}</span>
			</div>

			<div class="flex items-center justify-center gap-4">
				<button
					type="button"
					class="now-toggle flex h-11 w-11 items-center justify-center"
					class:on={player.shuffle}
					aria-pressed={player.shuffle}
					onclick={() => {
						haptics.tick();
						player.toggleShuffle();
					}}
					aria-label={m.player_shuffle()}
				>
					<Shuffle size={20} />
				</button>
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
					class="now-primary-control flex h-16 w-16 items-center justify-center rounded-full bg-(--action) text-(--action-contrast)"
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
				<button
					type="button"
					class="now-toggle flex h-11 w-11 items-center justify-center"
					class:on={player.repeatMode !== 'off'}
					aria-pressed={player.repeatMode !== 'off'}
					onclick={() => {
						haptics.tick();
						player.cycleRepeat();
					}}
					aria-label={m.player_repeat()}
				>
					<RepeatIcon size={20} />
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

<style>
	.now-artwork {
		border-radius: var(--radius-xl);
		box-shadow: 0 24px 42px -26px rgb(6 48 100 / 44%);
	}

	.now-toggle {
		color: var(--text-muted);
		border-radius: var(--radius-full);
		transition: color var(--dur-fast) var(--ease-out);
	}

	.now-toggle.on {
		color: var(--action);
	}

	.now-primary-control {
		box-shadow: 0 10px 22px -12px color-mix(in oklab, var(--action) 62%, transparent);
		transition:
			transform var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out);
	}

	.now-primary-control:hover {
		transform: scale(1.04);
		box-shadow: 0 13px 27px -12px color-mix(in oklab, var(--action) 68%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.now-primary-control,
		.now-toggle {
			transition: none;
		}
	}
</style>
