<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ExternalLink, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const retryHref = $derived(
		data.id ? resolve('/app/albums/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalAlbumUrl = $derived(
		data.album ? `https://tidal.com/browse/album/${encodeURIComponent(data.album.id)}` : ''
	);
	const tidalEmbedUrl = $derived(
		data.album ? `https://embed.tidal.com/albums/${encodeURIComponent(data.album.id)}` : ''
	);

	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}

	function formatTotalDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours} hr ${minutes} min`;
		return `${minutes} min`;
	}

	function formatQuality(quality: string): string {
		return quality.replaceAll('_', ' ');
	}
</script>

<svelte:head>
	<title>{data.album ? `${data.album.title} — Syn` : `${m.album_title()} — Syn`}</title>
	<meta
		name="description"
		content={data.album
			? m.album_description({ title: data.album.title })
			: m.album_description_empty()}
	/>
</svelte:head>

<section class="album-page" aria-labelledby="album-title">
	{#if data.album}
		<header class="album-header">
			{#if data.album.imageUrl}
				<img class="cover" src={data.album.imageUrl} alt={`Cover art for ${data.album.title}`} />
			{:else}
				<div class="cover cover-placeholder" aria-hidden="true"><Disc size={48} /></div>
			{/if}
			<div class="heading">
				<p class="eyebrow">{m.album_label()}</p>
				<h1 id="album-title">{data.album.title}</h1>
				{#if data.album.artists.length}
					<p class="artist-line">
						{#each data.album.artists as artist, i (artist.id)}
							<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
							>{#if i < data.album.artists.length - 1},
							{/if}
						{/each}
					</p>
				{/if}

				<div class="meta-line">
					{#if data.album.releaseDate}
						<span>{data.album.releaseDate.slice(0, 4)}</span>
					{/if}
					{#if data.album.numberOfItems}
						<span>·</span>
						<span>{data.album.numberOfItems} {m.album_tracks_count()}</span>
					{/if}
					{#if data.album.duration}
						<span>·</span>
						<span>{formatTotalDuration(data.album.duration)}</span>
					{/if}
					{#if data.album.audioQuality}
						<span class="quality-badge">{formatQuality(data.album.audioQuality)}</span>
					{/if}
				</div>
			</div>
		</header>

		<section class="player" aria-label={`Play ${data.album.title} on TIDAL`}>
			<iframe
				title={`TIDAL player: ${data.album.title}`}
				src={tidalEmbedUrl}
				allow="autoplay; encrypted-media"
			></iframe>
		</section>

		{#if data.album.items.length}
			<section class="tracklist-section" aria-labelledby="tracklist-title">
				<div class="section-header">
					<h2 id="tracklist-title">{m.album_tracklist()}</h2>
					<span class="track-count">{data.album.items.length} {m.album_tracks_count()}</span>
				</div>
				<ol class="track-list">
					{#each data.album.items as track, index (track.id)}
						<li>
							<span class="track-num">{track.trackNumber ?? index + 1}</span>
							<div class="track-main">
								<a class="track-link" href={resolve('/app/tracks/[id]', { id: track.id })}>
									<strong>{track.title}</strong>
								</a>
								{#if track.artists.length > 1 || track.artists[0]?.name !== data.album.artists[0]?.name}
									<span class="track-artists">
										{#each track.artists as artist, i (artist.id)}
											<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
											>{#if i < track.artists.length - 1},
											{/if}
										{/each}
									</span>
								{/if}
							</div>
							{#if track.explicit}
								<span class="explicit-badge" title="Explicit">E</span>
							{/if}
							{#if track.duration}
								<time class="track-time">{formatDuration(track.duration)}</time>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if data.album.copyright}
			<p class="copyright">{data.album.copyright}</p>
		{/if}

		<div class="actions">
			<a class="tidal-link" href={tidalAlbumUrl} rel="noreferrer" target="_blank">
				<Play size={17} fill="currentColor" />
				{m.album_open_in_tidal()}
				<ExternalLink size={15} />
			</a>
			<a class="back-link" href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</div>
	{:else if data.state === 'not_connected'}
		<section class="state-card" aria-labelledby="album-title">
			<h1 id="album-title">{m.album_not_connected_title()}</h1>
			<p>{m.album_not_connected_description()}</p>
			{#if data.configured}
				<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
			{:else}
				<p>{m.tidal_not_configured()}</p>
			{/if}
		</section>
	{:else if data.state === 'authorization_expired'}
		<section class="state-card" aria-labelledby="album-title">
			<h1 id="album-title">{m.album_authorization_expired_title()}</h1>
			<p>{m.album_authorization_expired_description()}</p>
			<a href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if data.state === 'not_found' || data.state === 'invalid_id'}
		<section class="state-card" aria-labelledby="album-title">
			<h1 id="album-title">{m.album_not_found_title()}</h1>
			<p>{m.album_not_found_description()}</p>
			<a href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</section>
	{:else}
		<section class="state-card" aria-labelledby="album-title">
			<h1 id="album-title">{m.album_unavailable_title()}</h1>
			<p role="alert">{m.album_unavailable_description()}</p>
			<a href={retryHref}>{m.track_retry()}</a>
		</section>
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.album-page {
		max-width: 72rem;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	.album-header {
		display: flex;
		align-items: end;
		gap: clamp(1rem, 3vw, 2rem);
	}

	.cover {
		width: clamp(8rem, 19vw, 14rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border-radius: 0.75rem;
		background: var(--surface-selected);
		object-fit: cover;
		box-shadow: var(--shadow-raised);
	}

	.cover-placeholder {
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
		font-size: clamp(1.8rem, 4.5vw, 3rem);
		letter-spacing: -0.05em;
		line-height: 1.15;
	}

	.artist-line {
		margin: 0.25rem 0 0.5rem;
		font-size: 1.15rem;
		font-weight: 600;
	}

	.artist-line a {
		color: var(--text-primary);
		text-decoration: none;
	}

	.artist-line a:hover,
	.artist-line a:focus-visible {
		text-decoration: underline;
	}

	.meta-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.quality-badge {
		border-radius: 0.35rem;
		background: var(--surface-selected);
		padding: 0.15rem 0.45rem;
		color: var(--text-primary);
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.player {
		margin-top: 1.75rem;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		background: var(--surface-raised);
	}

	.player iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}

	.tracklist-section {
		margin-top: 1.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		background: var(--surface-raised);
		padding: clamp(1rem, 3vw, 1.5rem);
	}

	.section-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.track-count {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.track-list li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.75rem;
		min-height: 3.25rem;
		border-top: 1px solid var(--border-subtle);
		padding: 0.4rem 0;
	}

	.track-list li:first-child {
		border-top: 0;
	}

	.track-num {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		padding-right: 0.25rem;
	}

	.track-main {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}

	.track-link {
		color: inherit;
		text-decoration: none;
	}

	.track-link:hover strong,
	.track-link:focus-visible strong {
		text-decoration: underline;
	}

	.track-artists {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.track-artists a {
		color: inherit;
		text-decoration: none;
	}

	.track-artists a:hover,
	.track-artists a:focus-visible {
		text-decoration: underline;
	}

	.explicit-badge {
		border-radius: 0.25rem;
		background: var(--surface-selected);
		padding: 0.1rem 0.35rem;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 700;
	}

	.track-time {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.copyright {
		margin-top: 1rem;
		color: var(--text-muted);
		font-size: 0.75rem;
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

	@media (max-width: 42rem) {
		.album-header {
			align-items: start;
		}
		.player iframe {
			height: 10.75rem;
		}
	}
</style>
