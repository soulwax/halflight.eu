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
				<p class="eyebrow">SYN // ARTIST PROFILE</p>
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
					<div class="flex items-center gap-2">
						<span class="geo-square"></span>
						<h2 id="top-tracks-title">{m.artist_top_tracks()}</h2>
					</div>
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
							<Sparkles size={18} class="text-[var(--action)]" />
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
				<div class="mb-4 flex items-center gap-2">
					<span class="geo-diamond"></span>
					<h2 id="albums-title">{m.artist_albums()}</h2>
				</div>
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
									<span class="font-mono">{album.releaseDate.slice(0, 4)}</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.artist.similarArtists.length}
			<section class="section-block" aria-labelledby="similar-title">
				<div class="mb-4 flex items-center gap-2">
					<span class="geo-circle"></span>
					<h2 id="similar-title">{m.artist_similar()}</h2>
				</div>
				<div class="grid-artists">
					{#each data.artist.similarArtists as similar (similar.id)}
						<a class="similar-card" href={resolve('/app/artists/[id]', { id: similar.id })}>
							<div class="similar-avatar" aria-hidden="true"><User size={22} /></div>
							<strong>{similar.name}</strong>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<div class="actions">
			<a class="tidal-link" href={tidalArtistUrl} rel="noreferrer" target="_blank">
				<Play size={15} fill="currentColor" />
				{m.artist_open_in_tidal()}
				<ExternalLink size={13} />
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
		gap: clamp(1.25rem, 3vw, 2.5rem);
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 2rem;
	}

	.avatar {
		width: clamp(6.5rem, 15vw, 10rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border-radius: 50%;
		border: 2px solid var(--border-strong);
		background: var(--surface-canvas);
		object-fit: cover;
		box-shadow: var(--shadow-bauhaus);
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
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin-bottom: 0.35rem;
		overflow-wrap: anywhere;
		font-size: clamp(2rem, 5vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.meta-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.popularity-badge {
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		padding: 0.2rem 0.55rem;
		color: var(--action);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-block {
		margin-top: 2rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: clamp(1.25rem, 3vw, 1.75rem);
	}

	.section-block h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.tracks-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.75rem;
	}

	.play-all-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--action);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.45rem 0.9rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.play-all-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.geo-square {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		background: var(--bauhaus-blue);
	}

	.geo-diamond {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		background: var(--bauhaus-yellow);
		transform: rotate(45deg);
	}

	.geo-circle {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		background: var(--bauhaus-red);
		border-radius: 50%;
	}

	.section-subtitle {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 0.75rem;
	}

	.grid-albums {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 1rem;
	}

	.album-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: inherit;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.album-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.card-cover {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
	}

	.card-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.card-info strong {
		font-size: 0.9rem;
		font-weight: 700;
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
		border: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: inherit;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.similar-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.similar-avatar {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		border: 1px solid var(--border-strong);
		background: var(--surface-selected);
		display: grid;
		place-items: center;
		color: var(--text-primary);
	}

	.similar-card strong {
		font-size: 0.85rem;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 2rem;
	}

	.tidal-link {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		gap: 0.4rem;
		background: var(--action);
		border: 2px solid var(--border-strong);
		padding: 0.6rem 1.15rem;
		color: var(--action-contrast);
		font-weight: 800;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.tidal-link:hover {
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.state-card {
		margin-top: 1.5rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: clamp(1.25rem, 3vw, 1.75rem);
	}

	.state-card p {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.state-card a,
	.back-link {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-strong);
		padding: 0.6rem 1.15rem;
		font-weight: 800;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
	}

	.state-card a {
		background: var(--action);
		color: var(--action-contrast);
	}

	.back-link {
		color: var(--text-primary);
		background: transparent;
	}

	.back-link:hover {
		background: var(--surface-selected);
	}

	.attribution {
		margin-top: 2.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}
</style>
