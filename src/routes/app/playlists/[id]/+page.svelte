<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download, Play } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { downloadM3u8File, generateM3u8 } from '#lib/utils/m3u';
	import Button from '#lib/components/ui/Button.svelte';
	import PageHeader from '#lib/components/music/PageHeader.svelte';
	import TrackList from '#lib/components/music/TrackList.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import PageActions from '#lib/components/music/PageActions.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const retryHref = $derived(
		data.id ? resolve('/app/playlists/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalPlaylistUrl = $derived(
		data.playlist ? `https://tidal.com/browse/playlist/${encodeURIComponent(data.playlist.id)}` : ''
	);

	function formatTotalDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours} hr ${minutes} min`;
		return `${minutes} min`;
	}
</script>

<svelte:head>
	<title>{data.playlist ? `${data.playlist.title} — Syn` : `${m.playlist_title()} — Syn`}</title>
	<meta
		name="description"
		content={data.playlist
			? m.playlist_description({ title: data.playlist.title })
			: m.playlist_description_empty()}
	/>
</svelte:head>

<section class="playlist-page" aria-labelledby="playlist-title">
	{#if data.playlist}
		<PageHeader
			title={data.playlist.title}
			imageUrl={data.playlist.imageUrl}
			eyebrow="SYN // CURATED PLAYLIST"
			type="playlist"
		>
			{#if data.playlist.description}
				<p class="line-clamp-2 text-sm text-[var(--text-muted)]">{data.playlist.description}</p>
			{/if}
			<div class="meta-line">
				{#if data.playlist.creator}
					<span class="font-bold"
						>{m.playlist_by({ creator: data.playlist.creator.name ?? 'TIDAL' })}</span
					>
					<span>·</span>
				{/if}
				{#if data.playlist.numberOfItems || data.playlist.items.length}
					<span class="font-mono"
						>{data.playlist.numberOfItems ?? data.playlist.items.length}
						{m.playlist_track_count()}</span
					>
				{/if}
				{#if data.playlist.duration}
					<span>·</span>
					<span class="font-mono">{formatTotalDuration(data.playlist.duration)}</span>
				{/if}
			</div>

			{#snippet actions()}
				{#if data.playlist.items.length}
					<Button
						variant="primary"
						onclick={() => player.play(data.playlist!.items[0], data.playlist!.items)}
					>
						<Play size={14} fill="currentColor" />
						{m.player_play_all()}
					</Button>

					<Button
						variant="secondary"
						onclick={() => {
							if (!data.playlist) return;
							const m3uContent = generateM3u8(data.playlist.title, data.playlist.items);
							downloadM3u8File(`${data.playlist.title}.m3u8`, m3uContent);
						}}
						title="Export as M3U8 Playlist"
						ariaLabel="Export as M3U8 Playlist"
					>
						<Download size={14} />
						M3U8
					</Button>
				{/if}
			{/snippet}
		</PageHeader>

		{#if data.playlist.items.length}
			<section class="tracklist-section" aria-labelledby="playlist-title">
				<TrackList
					tracks={data.playlist.items}
					contextTracks={data.playlist.items}
					showAlbum={true}
				/>
			</section>
		{/if}

		<PageActions tidalUrl={tidalPlaylistUrl} tidalLabel={m.playlist_open_in_tidal()} {retryHref} />
	{:else}
		<StateCard state={data.state} configured={data.configured} id={data.id} {retryHref} />
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.playlist-page {
		max-width: 72rem;
	}

	.meta-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.tracklist-section {
		margin-top: 2rem;
	}

	.attribution {
		margin-top: 3rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}
</style>
