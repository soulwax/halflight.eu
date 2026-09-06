<script lang="ts">
	import { resolve } from '$app/paths';
	import { Play, Sparkles, User } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import PageHeader from '#lib/components/music/PageHeader.svelte';
	import MediaCard from '#lib/components/music/MediaCard.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import PageActions from '#lib/components/music/PageActions.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const retryHref = $derived(
		data.id ? resolve('/app/artists/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalArtistUrl = $derived(
		data.artist ? `https://tidal.com/browse/artist/${encodeURIComponent(data.artist.id)}` : ''
	);
</script>

<svelte:head>
	<title
		>{data.artist
			? `${data.artist.name} — ${m.brand_name()}`
			: `${m.artist_title()} — ${m.brand_name()}`}</title
	>
	<meta
		name="description"
		content={data.artist
			? m.artist_description({ name: data.artist.name })
			: m.artist_description_empty()}
	/>
</svelte:head>

<section class="artist-page" aria-labelledby="artist-title">
	{#if data.artist}
		<PageHeader
			title={data.artist.name}
			imageUrl={data.artist.imageUrl}
			eyebrow="HALFLIGHT // ARTIST PROFILE"
			type="artist"
		>
			<div class="meta-line">
				{#if data.artist.popularity !== undefined}
					<Badge variant="accent" text={`${m.artist_popularity()}: ${data.artist.popularity}%`} />
				{/if}
			</div>
		</PageHeader>

		{#if data.artist.topTracks.length}
			<section class="section-block" aria-labelledby="top-tracks-title">
				<SectionHeader title={m.artist_top_tracks()} titleId="top-tracks-title">
					{#snippet actions()}
						<Button
							variant="primary"
							onclick={() => player.play(data.artist!.topTracks[0], data.artist!.topTracks)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>
					{/snippet}
				</SectionHeader>
				<div class="song-cards-grid">
					{#each data.artist.topTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.artist?.topTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.radioTracks && data.artist.radioTracks.length}
			<section class="section-block" aria-labelledby="artist-radio-title">
				<SectionHeader
					title={m.artist_radio_title()}
					titleId="artist-radio-title"
					subtitle={m.artist_radio_subtitle({ name: data.artist.name })}
				>
					<Sparkles size={18} class="text-[var(--action)]" />

					{#snippet actions()}
						<Button
							variant="primary"
							onclick={() => player.play(data.artist!.radioTracks![0], data.artist!.radioTracks)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>
					{/snippet}
				</SectionHeader>
				<div class="song-cards-grid">
					{#each data.artist.radioTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.artist.radioTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.albums.length}
			<section class="section-block" aria-labelledby="albums-title">
				<SectionHeader title={m.artist_albums()} titleId="albums-title" />
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each data.artist.albums as album (album.id)}
						<MediaCard item={album} kind="album" />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.similarArtists.length}
			<section class="section-block" aria-labelledby="similar-title">
				<SectionHeader title={m.artist_similar()} titleId="similar-title" />
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
					{#each data.artist.similarArtists as similar (similar.id)}
						<a class="similar-card" href={resolve('/app/artists/[id]', { id: similar.id })}>
							<div class="similar-avatar" aria-hidden="true"><User size={22} /></div>
							<strong class="truncate text-xs font-bold">{similar.name}</strong>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<PageActions tidalUrl={tidalArtistUrl} tidalLabel={m.artist_open_in_tidal()} {retryHref} />
	{:else}
		<StateCard state={data.state} configured={data.configured} {retryHref} />
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.artist-page {
		max-width: 72rem;
	}

	.meta-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.section-block {
		margin-top: 2.75rem;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.15rem;
	}

	.similar-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.65rem;
		padding: 1rem 0.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-md);
		color: inherit;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.similar-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-panel);
		transform: translate(-1px, -1px);
	}

	.similar-avatar {
		width: 3.25rem;
		height: 3.25rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		display: grid;
		place-items: center;
		color: var(--text-muted);
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
