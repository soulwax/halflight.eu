<script lang="ts">
	import { resolve } from '$app/paths';
	import { ExternalLink, ListMusic, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const retryHref = $derived(
		data.id ? resolve('/app/playlists/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalPlaylistUrl = $derived(
		data.playlist ? `https://tidal.com/browse/playlist/${encodeURIComponent(data.playlist.id)}` : ''
	);
	const tidalEmbedUrl = $derived(
		data.playlist ? `https://embed.tidal.com/playlists/${encodeURIComponent(data.playlist.id)}` : ''
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
		<header class="playlist-header">
			{#if data.playlist.imageUrl}
				<img class="cover" src={data.playlist.imageUrl} alt={`Cover for ${data.playlist.title}`} />
			{:else}
				<div class="cover cover-placeholder" aria-hidden="true"><ListMusic size={48} /></div>
			{/if}
			<div class="heading">
				<p class="eyebrow">{m.playlist_label()}</p>
				<h1 id="playlist-title">{data.playlist.title}</h1>
				{#if data.playlist.description}
					<p class="description">{data.playlist.description}</p>
				{/if}
				<div class="meta-line">
					{#if data.playlist.creator}
						<span>{m.playlist_by({ creator: data.playlist.creator.name ?? 'TIDAL' })}</span>
						<span>·</span>
					{/if}
					{#if data.playlist.numberOfItems || data.playlist.items.length}
						<span
							>{data.playlist.numberOfItems ?? data.playlist.items.length}
							{m.playlist_track_count()}</span
						>
					{/if}
					{#if data.playlist.duration}
						<span>·</span>
						<span>{formatTotalDuration(data.playlist.duration)}</span>
					{/if}
				</div>
			</div>
		</header>

		<section class="player" aria-label={`Play ${data.playlist.title} on TIDAL`}>
			<iframe
				title={`TIDAL player: ${data.playlist.title}`}
				src={tidalEmbedUrl}
				allow="autoplay; encrypted-media"
			></iframe>
		</section>

		{#if data.playlist.items.length}
			<section class="tracklist-section" aria-labelledby="tracklist-title">
				<ol class="track-list">
					{#each data.playlist.items as track, index (track.id)}
						<li>
							<span class="track-num">{index + 1}</span>
							<div class="track-main">
								<a class="track-link" href={resolve('/app/tracks/[id]', { id: track.id })}>
									<strong>{track.title}</strong>
								</a>
								{#if track.artists.length}
									<span class="track-artists">
										{#each track.artists as artist, i (artist.id)}
											<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
											>{#if i < track.artists.length - 1},
											{/if}
										{/each}
									</span>
								{/if}
							</div>
							{#if track.album}
								<span class="track-album">
									<a href={resolve('/app/albums/[id]', { id: track.album.id })}
										>{track.album.title}</a
									>
								</span>
							{/if}
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

		<div class="actions">
			<a class="tidal-link" href={tidalPlaylistUrl} rel="noreferrer" target="_blank">
				<Play size={17} fill="currentColor" />
				{m.playlist_open_in_tidal()}
				<ExternalLink size={15} />
			</a>
			<a class="back-link" href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</div>
	{:else if data.state === 'not_connected'}
		<section class="state-card" aria-labelledby="playlist-title">
			<h1 id="playlist-title">{m.playlist_not_connected_title()}</h1>
			<p>{m.playlist_not_connected_description()}</p>
			{#if data.configured}
				<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
			{:else}
				<p>{m.tidal_not_configured()}</p>
			{/if}
		</section>
	{:else if data.state === 'authorization_expired'}
		<section class="state-card" aria-labelledby="playlist-title">
			<h1 id="playlist-title">{m.playlist_authorization_expired_title()}</h1>
			<p>{m.playlist_authorization_expired_description()}</p>
			<a href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if data.state === 'not_found' || data.state === 'invalid_id'}
		<section class="state-card" aria-labelledby="playlist-title">
			<h1 id="playlist-title">{m.playlist_not_found_title()}</h1>
			<p>{m.playlist_not_found_description()}</p>
			<a href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</section>
	{:else}
		<section class="state-card" aria-labelledby="playlist-title">
			<h1 id="playlist-title">{m.playlist_unavailable_title()}</h1>
			<p role="alert">{m.playlist_unavailable_description()}</p>
			<a href={retryHref}>{m.track_retry()}</a>
		</section>
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.playlist-page {
		max-width: 72rem;
	}

	h1,
	p {
		margin-top: 0;
	}

	.playlist-header {
		display: flex;
		align-items: end;
		gap: clamp(1rem, 3vw, 2rem);
	}

	.cover {
		width: clamp(8rem, 19vw, 13rem);
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

	.description {
		margin: 0.25rem 0 0.5rem;
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.meta-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-muted);
		font-size: 0.9rem;
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

	.track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.track-list li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1.5fr) minmax(0, 1fr) auto auto;
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

	.track-artists,
	.track-album {
		color: var(--text-muted);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-artists a,
	.track-album a {
		color: inherit;
		text-decoration: none;
	}

	.track-artists a:hover,
	.track-artists a:focus-visible,
	.track-album a:hover,
	.track-album a:focus-visible {
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
		.playlist-header {
			align-items: start;
		}
		.track-list li {
			grid-template-columns: 2rem minmax(0, 1fr) auto auto;
		}
		.track-album {
			display: none;
		}
		.player iframe {
			height: 10.75rem;
		}
	}
</style>
