<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ExternalLink, Play, Sparkles, User } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
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
	<title>{data.artist ? `${data.artist.name} — Syn` : `${m.artist_title()} — Syn`}</title>
	<meta
		name="description"
		content={data.artist
			? m.artist_description({ name: data.artist.name })
			: m.artist_description_empty()}
	/>
</svelte:head>

<section class="artist-page" aria-labelledby="artist-title">
	{#if data.artist}
		<header class="artist-header">
			{#if data.artist.imageUrl}
				<img class="avatar" src={data.artist.imageUrl} alt={`Photo of ${data.artist.name}`} />
			{:else}
				<div class="avatar avatar-placeholder" aria-hidden="true"><User size={48} /></div>
			{/if}
			<div class="heading">
				<p class="eyebrow">{m.artist_label()}</p>
				<h1 id="artist-title">{data.artist.name}</h1>
				<div class="meta-line">
					{#if data.artist.popularity !== undefined}
						<span class="popularity-badge">{m.artist_popularity()}: {data.artist.popularity}%</span>
					{/if}
				</div>
			</div>
		</header>

		{#if data.artist.topTracks.length}
			<section class="section-block" aria-labelledby="top-tracks-title">
				<div class="tracks-header">
					<h2 id="top-tracks-title">{m.artist_top_tracks()}</h2>
					<button
						type="button"
						class="play-all-btn"
						onclick={() => player.play(data.artist!.topTracks[0], data.artist!.topTracks)}
					>
						<Play size={14} fill="currentColor" />
						{m.player_play_all()}
					</button>
				</div>
				<div class="song-cards-grid">
					{#each data.artist.topTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.artist?.topTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.radioTracks && data.artist.radioTracks.length}
			<section class="section-block" aria-labelledby="artist-radio-title">
				<div class="tracks-header">
					<div>
						<h2 id="artist-radio-title" class="flex items-center gap-2">
							<Sparkles size={20} class="text-[var(--action)]" />
							{m.artist_radio_title()}
						</h2>
						<p class="section-subtitle">
							{m.artist_radio_subtitle({ name: data.artist.name })}
						</p>
					</div>
					<button
						type="button"
						class="play-all-btn"
						onclick={() => player.play(data.artist!.radioTracks![0], data.artist!.radioTracks)}
					>
						<Play size={14} fill="currentColor" />
						{m.player_play_all()}
					</button>
				</div>
				<div class="song-cards-grid">
					{#each data.artist.radioTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.artist.radioTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.albums.length}
			<section class="section-block" aria-labelledby="albums-title">
				<h2 id="albums-title">{m.artist_albums()}</h2>
				<div class="grid-albums">
					{#each data.artist.albums as album (album.id)}
						<a class="album-card" href={resolve('/app/albums/[id]', { id: album.id })}>
							{#if album.imageUrl}
								<img
									class="card-cover"
									src={album.imageUrl}
									alt={`Cover for ${album.title}`}
									loading="lazy"
								/>
							{:else}
								<div class="card-cover cover-placeholder" aria-hidden="true">
									<Disc size={28} />
								</div>
							{/if}
							<div class="card-info">
								<strong>{album.title}</strong>
								{#if album.releaseDate}
									<span>{album.releaseDate.slice(0, 4)}</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.similarArtists.length}
			<section class="section-block" aria-labelledby="similar-title">
				<h2 id="similar-title">{m.artist_similar()}</h2>
				<div class="grid-artists">
					{#each data.artist.similarArtists as similar (similar.id)}
						<a class="similar-card" href={resolve('/app/artists/[id]', { id: similar.id })}>
							<div class="similar-avatar" aria-hidden="true"><User size={24} /></div>
							<strong>{similar.name}</strong>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<div class="actions">
			<a class="tidal-link" href={tidalArtistUrl} rel="noreferrer" target="_blank">
				<Play size={17} fill="currentColor" />
				{m.artist_open_in_tidal()}
				<ExternalLink size={15} />
			</a>
			<a class="back-link" href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</div>
	{:else if data.state === 'not_connected'}
		<section class="state-card" aria-labelledby="artist-title">
			<h1 id="artist-title">{m.artist_not_connected_title()}</h1>
			<p>{m.artist_not_connected_description()}</p>
			{#if data.configured}
				<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
			{:else}
				<p>{m.tidal_not_configured()}</p>
			{/if}
		</section>
	{:else if data.state === 'authorization_expired'}
		<section class="state-card" aria-labelledby="artist-title">
			<h1 id="artist-title">{m.artist_authorization_expired_title()}</h1>
			<p>{m.artist_authorization_expired_description()}</p>
			<a href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if data.state === 'not_found' || data.state === 'invalid_id'}
		<section class="state-card" aria-labelledby="artist-title">
			<h1 id="artist-title">{m.artist_not_found_title()}</h1>
			<p>{m.artist_not_found_description()}</p>
			<a href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</section>
	{:else}
		<section class="state-card" aria-labelledby="artist-title">
			<h1 id="artist-title">{m.artist_unavailable_title()}</h1>
			<p role="alert">{m.artist_unavailable_description()}</p>
			<a href={retryHref}>{m.track_retry()}</a>
		</section>
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.artist-page {
		max-width: 72rem;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	.artist-header {
		display: flex;
		align-items: center;
		gap: clamp(1.25rem, 4vw, 2.25rem);
	}

	.avatar {
		width: clamp(7rem, 16vw, 11rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border-radius: 9999px;
		background: var(--surface-selected);
		object-fit: cover;
		box-shadow: var(--shadow-raised);
	}

	.avatar-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.heading {
		min-width: 0;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1 {
		margin-bottom: 0.35rem;
		overflow-wrap: anywhere;
		font-size: clamp(2rem, 5vw, 3.5rem);
		letter-spacing: -0.05em;
		line-height: 1.15;
	}

	.meta-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.4rem;
	}

	.popularity-badge {
		border-radius: 0.35rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		padding: 0.2rem 0.55rem;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.section-block {
		margin-top: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.section-block h2 {
		margin: 0 0 1rem;
		font-size: 1.2rem;
	}

	.tracks-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.tracks-header h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.play-all-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 0;
		border-radius: 0.5rem;
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.4rem 0.8rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.play-all-btn:hover {
		opacity: 0.9;
	}

	.section-subtitle {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
		gap: 0.75rem;
	}

	.grid-albums {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 1rem;
	}

	.album-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.65rem;
		border-radius: 0.65rem;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		color: inherit;
		text-decoration: none;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease;
	}

	.album-card:hover,
	.album-card:focus-visible {
		transform: translateY(-2px);
		border-color: var(--border-strong);
	}

	.card-cover {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 0.45rem;
		object-fit: cover;
		background: var(--surface-selected);
	}

	.card-info {
		display: grid;
		gap: 0.15rem;
	}

	.card-info strong {
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-info span {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.grid-artists {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 0.75rem;
	}

	.similar-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
		padding: 0.85rem 0.5rem;
		border-radius: 0.65rem;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		color: inherit;
		text-decoration: none;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease;
	}

	.similar-card:hover,
	.similar-card:focus-visible {
		transform: translateY(-2px);
		border-color: var(--border-strong);
	}

	.similar-avatar {
		width: 3rem;
		height: 3rem;
		border-radius: 9999px;
		background: var(--surface-selected);
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.similar-card strong {
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.tidal-link {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.4rem;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font-weight: 700;
		text-decoration: none;
	}

	.state-card {
		margin-top: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.state-card p {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.state-card a,
	.back-link {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		font-weight: 700;
		text-decoration: none;
	}

	.state-card a {
		background: var(--action);
		color: var(--action-contrast);
	}

	.back-link {
		color: var(--text-primary);
	}

	.attribution {
		margin-top: 2rem;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.attribution a {
		color: inherit;
	}
</style>
