<script lang="ts">
	import { Disc } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatReleaseDate } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import { contextActions } from '#lib/context-menu/context-menu.svelte';
	import { resolve } from '$app/paths';
	import { mediaActions, nowPlayingActions } from '#lib/context-menu/actions';

	let { track }: { track: TrackSummary } = $props();

	const cover = $derived(trackArtworkUrl(track, 160));
	let failedCover = $state<string | null>(null);
	const releaseYear = $derived(formatReleaseDate(track.album?.releaseDate));
	const albumLine = $derived(
		track.album ? `${track.album.title}${releaseYear ? ` · ${releaseYear}` : ''}` : ''
	);
</script>

<div class="identity" use:contextActions={() => nowPlayingActions(track)}>
	<span class="cover" class:spin={player.isPlaying && !player.isLoading}>
		{#if cover && cover !== failedCover}
			<img src={cover} alt="" decoding="async" onerror={() => (failedCover = cover)} />
		{:else}
			<span class="cover-fallback"><Disc size={18} /></span>
		{/if}
	</span>

	<div class="meta">
		<button
			type="button"
			class="title"
			onclick={() => player.selectPanel('queue')}
			aria-label={m.player_now_playing()}>{track.title}</button
		>
		<span class="sub">
			{#if track.artists.length}<span class="artists"
					>{#each track.artists as artist, index (index)}{#if index},
						{/if}{#if artist.id}<a
								href={resolve('/app/artists/[id]', { id: artist.id })}
								use:contextActions={() => mediaActions('artist', artist.id, artist.name)}
								>{artist.name}</a
							>{:else}{artist.name}{/if}{/each}</span
				>{/if}
			{#if albumLine}
				<span aria-hidden="true">·</span>{#if track.album?.id}<a
						class="album"
						title={albumLine}
						href={resolve('/app/albums/[id]', { id: track.album.id })}
						use:contextActions={() => mediaActions('album', track.album!.id, track.album!.title)}
						>{albumLine}</a
					>{:else}<span class="album" title={albumLine}>{albumLine}</span>{/if}
			{/if}
		</span>
		{#if player.qualityLabel || player.playbackMode === 'embed' || track.provenance || player.assessment.warning}
			<span class="meta-tags">
				{#if player.qualityLabel}
					<span class="badge badge-tier-{player.qualityTier}">{player.qualityLabel}</span>
				{/if}
				{#if player.playbackMode === 'embed'}<span class="badge badge-embed">TIDAL</span>{/if}
				{#if track.provenance}
					<span class="badge badge-provenance max-w-[180px] truncate" title={track.provenance}>
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
		{/if}
	</div>
</div>

<style>
	.artists a,
	a.album {
		color: inherit;
		text-decoration: none;
	}
	.artists a:hover,
	a.album:hover {
		color: var(--action);
		text-decoration: underline;
	}
	.artists a:focus-visible,
	a.album:focus-visible {
		outline: 2px solid var(--action);
		outline-offset: 3px;
	}
</style>
