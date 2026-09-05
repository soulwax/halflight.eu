<script lang="ts">
	import MediaCard from '#lib/components/music/MediaCard.svelte';
	import PageActions from '#lib/components/music/PageActions.svelte';
	import PageHeader from '#lib/components/music/PageHeader.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import TrackTable from '#lib/components/music/TrackTable.svelte';
	import TrackQueueActions from '#lib/components/music/TrackQueueActions.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { downloadM3u8File, generateM3u8 } from '#lib/utils/m3u';
	import { resolve } from '$app/paths';
	import { BookOpen, Download, Play, Users } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const retryHref = $derived(
		data.id ? resolve('/app/albums/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalAlbumUrl = $derived(
		data.album ? `https://tidal.com/browse/album/${encodeURIComponent(data.album.id)}` : ''
	);
	const albumProvenance = $derived(
		data.album ? `${m.album_label()} · ${data.album.title}` : undefined
	);

	function formatTotalDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours} hr ${minutes} min`;
		return `${minutes} min`;
	}
</script>

<svelte:head>
	<title
		>{data.album
			? `${data.album.title} — ${m.brand_name()}`
			: `${m.album_title()} — ${m.brand_name()}`}</title
	>
	<meta
		name="description"
		content={data.album
			? m.album_description({ title: data.album.title })
			: m.album_description_empty()}
	/>
</svelte:head>

<section class="album-page" aria-labelledby="album-title">
	{#if data.album}
		<PageHeader
			title={data.album.title}
			imageUrl={data.album.imageUrl}
			eyebrow="HALFLIGHT // ALBUM RELEASE"
			type="album"
		>
			{#if data.album.artists.length}
				<p class="artist-line">
					{#each data.album.artists as artist, i (artist.id || i)}
						<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
						>{#if i < data.album.artists.length - 1},
						{/if}
					{/each}
				</p>
			{/if}

			<div class="meta-line">
				{#if data.album.releaseDate}
					<span class="font-mono">{data.album.releaseDate.slice(0, 4)}</span>
				{/if}
				{#if data.album.numberOfItems}
					<span>·</span>
					<span class="font-mono">{data.album.numberOfItems} {m.album_tracks_count()}</span>
				{/if}
				{#if data.album.duration}
					<span>·</span>
					<span class="font-mono">{formatTotalDuration(data.album.duration)}</span>
				{/if}
				{#if data.album.audioQuality}
					<Badge variant="quality" text={data.album.audioQuality} />
				{/if}
			</div>

			{#snippet actions()}
				{#if data.album.items.length}
					<Button
						variant="primary"
						onclick={() => player.play(data.album!.items[0], data.album!.items, albumProvenance)}
					>
						<Play size={14} fill="currentColor" />
						{m.player_play_all()}
					</Button>

					<Button
						variant="secondary"
						onclick={() => {
							if (!data.album) return;
							const m3uContent = generateM3u8(data.album.title, data.album.items);
							downloadM3u8File(`${data.album.title}.m3u8`, m3uContent);
						}}
						title={m.action_export_m3u8()}
						ariaLabel="Export as M3U8 Playlist"
					>
						<Download size={14} />
						M3U8
					</Button>
				{/if}
			{/snippet}
		</PageHeader>

		{#if data.album.items.length}
			<section class="tracklist-section" aria-labelledby="tracklist-title">
				<SectionHeader
					title={m.album_tracklist()}
					titleId="tracklist-title"
					count={`${data.album.items.length} ${m.album_tracks_count()}`}
				/>
				<TrackTable
					tracks={data.album.items}
					contextTracks={data.album.items}
					provenance={albumProvenance}
					columns={['duration']}
				>
					{#snippet rowActions(track)}
						<TrackQueueActions {track} provenance={albumProvenance} />
					{/snippet}
				</TrackTable>
			</section>
		{/if}

		{#if data.album.copyright}
			<p class="copyright">{data.album.copyright}</p>
		{/if}

		{#if data.review}
			<section class="review-section" aria-labelledby="album-review-title">
				<SectionHeader title={m.album_review_heading()} titleId="album-review-title">
					<BookOpen size={18} class="text-(--action)" />
					{#snippet actions()}
						{#if data.review?.source}
							<span class="font-mono text-xs text-(--text-muted)">Source: {data.review.source}</span
							>
						{/if}
					{/snippet}
				</SectionHeader>

				{#if data.review.summary}
					<blockquote class="review-summary">
						"{data.review.summary}"
					</blockquote>
				{/if}

				{#if data.review.normalizedText}
					<div class="review-body">
						{#each data.review.normalizedText.split('\n\n') as paragraph, idx (idx)}
							{#if paragraph.trim()}
								<p>{paragraph.trim()}</p>
							{/if}
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		{#if data.credits && data.credits.length}
			<section class="credits-section" aria-labelledby="album-credits-title">
				<SectionHeader
					title={m.album_credits_heading()}
					titleId="album-credits-title"
					count={`${data.credits.length} tracks credited`}
				>
					<Users size={18} class="text-(--action)" />
				</SectionHeader>

				<div class="credits-grid">
					{#each data.credits as trackCredit, idx (trackCredit.item.id || idx)}
						{#if trackCredit.credits && trackCredit.credits.length}
							<div class="credit-card">
								<h3 class="credit-track-title">{trackCredit.item.title || `Track ${idx + 1}`}</h3>
								<div class="credit-roles">
									{#each trackCredit.credits as creditRole (creditRole.type)}
										<div class="credit-role-row">
											<span class="role-type">{creditRole.type}</span>
											<span class="role-names"
												>{creditRole.contributors.map((c) => c.name).join(', ')}</span
											>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		{#if data.album.similarAlbums && data.album.similarAlbums.length}
			<section class="similar-albums-section" aria-labelledby="similar-albums-title">
				<SectionHeader
					title={m.album_similar_title()}
					titleId="similar-albums-title"
					subtitle={m.album_similar_subtitle()}
				/>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each data.album.similarAlbums as similar (similar.id)}
						<MediaCard item={similar} kind="album" />
					{/each}
				</div>
			</section>
		{/if}

		<PageActions tidalUrl={tidalAlbumUrl} tidalLabel={m.album_open_in_tidal()} {retryHref} />
	{:else}
		<StateCard state={data.state} configured={data.configured} {retryHref} />
	{/if}
</section>

<style>
	.artist-line {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.artist-line a {
		color: var(--text-primary);
		text-decoration: none;
	}

	.artist-line a:hover {
		color: var(--action);
		text-decoration: underline;
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
		margin-top: 2.5rem;
	}

	.copyright {
		margin-top: 1.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}

	.review-section {
		margin-top: 2.5rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 2rem;
	}

	.review-summary {
		margin: 0 0 1.25rem;
		padding: 1rem 1.25rem;
		border-left: 3px solid var(--action);
		background: var(--surface-raised);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		font-style: italic;
		color: var(--text-primary);
		line-height: 1.6;
	}

	.review-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--text-muted);
		line-height: 1.65;
		font-size: 0.92rem;
	}

	.credits-section {
		margin-top: 2.5rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 2rem;
	}

	.credits-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.credit-card {
		padding: 1rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.credit-track-title {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--text-primary);
		border-bottom: 1px dashed var(--border-subtle);
		padding-bottom: 0.4rem;
	}

	.credit-roles {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.credit-role-row {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		font-size: 0.78rem;
	}

	.role-type {
		font-family: ui-monospace, monospace;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--action);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.role-names {
		color: var(--text-muted);
		line-height: 1.3;
	}

	.similar-albums-section {
		margin-top: 2.5rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 2rem;
	}
</style>
