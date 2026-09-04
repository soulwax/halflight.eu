<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Loader2, Pause, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let { track }: { track: TrackSummary } = $props();

	const cover = $derived(track.imageUrl ?? track.album?.imageUrl ?? null);
	const artistLine = $derived(track.artists.map((a) => a.name).join(', '));
</script>

<div class="identity">
	<button
		type="button"
		class="cover"
		class:spin={player.isPlaying && !player.isLoading}
		onclick={() => player.togglePlayPause()}
		aria-label={player.isPlaying ? m.player_collapse() : m.player_play_track()}
	>
		{#if cover}
			<img src={cover} alt="" />
		{:else}
			<span class="cover-fallback"><Disc size={18} /></span>
		{/if}
		<span class="cover-cta">
			{#if player.isLoading}
				<Loader2 size={15} class="animate-spin" />
			{:else if player.isPlaying}
				<Pause size={15} fill="currentColor" />
			{:else}
				<Play size={15} fill="currentColor" />
			{/if}
		</span>
	</button>

	<div class="meta">
		<a class="title" href={resolve('/app/tracks/[id]', { id: track.id })}>{track.title}</a>
		<span class="sub">
			{#if artistLine}<span class="artists">{artistLine}</span>{/if}
			{#if player.qualityLabel}
				<span class="badge badge-tier-{player.qualityTier}">{player.qualityLabel}</span>
			{/if}
			{#if player.playbackMode === 'embed'}<span class="badge badge-embed">TIDAL</span>{/if}
			{#if track.provenance}
				<span
					class="badge max-w-[180px] truncate border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[0.65rem] text-[var(--accent-gold)]"
					title={track.provenance}
				>
					{track.provenance}
				</span>
			{/if}
			{#if player.assessment.warning}
				<button
					type="button"
					class="badge badge-warn"
					onclick={() => player.openPanel('source')}
					title={player.assessment.warning}
				>
					{player.assessment.isLikelyPreview ? m.player_preview() : m.player_check_failed()}
				</button>
			{/if}
		</span>
	</div>
</div>
