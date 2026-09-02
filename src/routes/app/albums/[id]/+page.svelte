<script lang="ts">
	import { resolve } from '$app/paths';
	import { BookOpen, Disc, Download, ExternalLink, ListPlus, Play } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { downloadM3u8File, generateM3u8 } from '#lib/utils/m3u';
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
				<p class="eyebrow">SYN // ALBUM RELEASE</p>
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
						<span class="quality-badge">{formatQuality(data.album.audioQuality)}</span>
					{/if}
				</div>

				{#if data.album.items.length}
					<div class="header-playback">
						<button
							type="button"
							class="play-album-btn"
							onclick={() => player.play(data.album!.items[0], data.album!.items)}
						>
							<Play size={15} fill="currentColor" />
							{m.player_play_all()}
						</button>

						<button
							type="button"
							class="export-m3u8-btn"
							onclick={() => {
								if (!data.album) return;
								const m3uContent = generateM3u8(data.album.title, data.album.items);
								downloadM3u8File(`${data.album.title}.m3u8`, m3uContent);
							}}
							title="Export as M3U8 Playlist"
							aria-label="Export as M3U8 Playlist"
						>
							<Download size={14} class="mr-1 inline" />
							M3U8
						</button>
					</div>
				{/if}
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
					<span class="track-count">[{data.album.items.length} {m.album_tracks_count()}]</span>
				</div>
				<ol class="track-list">
					{#each data.album.items as track, index (track.id)}
						<li>
							<button
								type="button"
								class="track-play-btn"
								onclick={() => player.play(track, data.album?.items)}
								title={m.player_play_track()}
								aria-label={m.player_play_track()}
							>
								<Play size={13} fill="currentColor" />
							</button>

							<span class="track-num"
								>{String(track.trackNumber ?? index + 1).padStart(2, '0')}</span
							>
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

							<button
								type="button"
								class="track-queue-btn"
								onclick={() => player.addToQueue(track)}
								title={m.player_add_to_queue()}
								aria-label={m.player_add_to_queue()}
							>
								<ListPlus size={15} />
							</button>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if data.album.copyright}
			<p class="copyright">{data.album.copyright}</p>
		{/if}

		{#if data.review}
			<section class="review-section" aria-labelledby="album-review-title">
				<div class="section-header">
					<div class="flex items-center gap-2">
						<BookOpen size={18} class="text-[var(--action)]" />
						<h2 id="album-review-title">Album Review</h2>
					</div>
					{#if data.review.source}
						<span class="review-source">Source: {data.review.source}</span>
					{/if}
				</div>

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

		{#if data.album.similarAlbums && data.album.similarAlbums.length}
			<section class="similar-albums-section" aria-labelledby="similar-albums-title">
				<h2 id="similar-albums-title">{m.album_similar_title()}</h2>
				<p class="similar-subtitle">{m.album_similar_subtitle()}</p>
				<div class="grid-albums">
					{#each data.album.similarAlbums as similar (similar.id)}
						<a class="album-card" href={resolve('/app/albums/[id]', { id: similar.id })}>
							{#if similar.imageUrl}
								<img
									class="card-cover"
									src={similar.imageUrl}
									alt={`Cover for ${similar.title}`}
									loading="lazy"
								/>
							{:else}
								<div class="card-cover cover-placeholder" aria-hidden="true">
									<Disc size={28} />
								</div>
							{/if}
							<div class="card-info">
								<strong>{similar.title}</strong>
								{#if similar.artists.length}
									<span class="card-artist">{similar.artists.map((a) => a.name).join(', ')}</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<div class="actions">
			<a class="tidal-link" href={tidalAlbumUrl} rel="noreferrer" target="_blank">
				<Play size={15} fill="currentColor" />
				{m.album_open_in_tidal()}
				<ExternalLink size={13} />
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
		gap: clamp(1.25rem, 3vw, 2.5rem);
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 2rem;
	}

	.cover {
		width: clamp(8rem, 19vw, 14rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-md, 10px);
		background: var(--surface-canvas);
		object-fit: cover;
		box-shadow: var(--shadow-bauhaus);
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
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin-bottom: 0.35rem;
		overflow-wrap: anywhere;
		font-size: clamp(2rem, 4.5vw, 3.25rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.artist-line {
		margin: 0.25rem 0 0.5rem;
		font-size: 1.15rem;
		font-weight: 700;
	}

	.artist-line a {
		color: var(--text-primary);
		text-decoration: none;
	}

	.artist-line a:hover,
	.artist-line a:focus-visible {
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

	.quality-badge {
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full, 9999px);
		padding: 0.15rem 0.55rem;
		color: var(--action);
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.header-playback {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}

	.play-album-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.65rem 1.35rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.play-album-btn:hover {
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.export-m3u8-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		color: var(--text-primary);
		padding: 0.65rem 1.15rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.export-m3u8-btn:hover {
		background: var(--surface-selected);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.review-section {
		margin-top: 2rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.review-source {
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.review-summary {
		margin: 1.25rem 0;
		padding: 0.85rem 1.25rem;
		border-left: 3px solid var(--action);
		background: var(--surface-sunken);
		border-radius: 0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0;
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.5;
		color: var(--text-primary);
	}

	.review-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.65;
	}

	.player {
		margin-top: 2rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-lg, 14px);
		overflow: hidden;
		background: var(--surface-raised);
		box-shadow: var(--shadow-bauhaus);
	}

	.player iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}

	.tracklist-section {
		margin-top: 2rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.85rem;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.track-count {
		font-family: ui-monospace, monospace;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.track-list li {
		display: grid;
		grid-template-columns: 2rem 2.2rem minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 0.75rem;
		min-height: 3.5rem;
		border-top: 1px solid var(--border-subtle);
		padding: 0.5rem 0;
	}

	.track-play-btn,
	.track-queue-btn {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		transition: all 0.12s ease;
	}

	.track-play-btn:hover {
		color: var(--action-contrast);
		border-color: var(--action);
		background: var(--action);
	}

	.track-queue-btn:hover {
		color: var(--text-primary);
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.track-list li:first-child {
		border-top: 0;
	}

	.track-num {
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		font-weight: 700;
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
		color: var(--action);
		text-decoration: underline;
	}

	.track-artists {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.track-artists a {
		color: inherit;
		text-decoration: none;
	}

	.track-artists a:hover,
	.track-artists a:focus-visible {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.explicit-badge {
		border: 1px solid var(--border-strong);
		padding: 0.1rem 0.3rem;
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.65rem;
		font-weight: 800;
	}

	.track-time {
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.copyright {
		margin-top: 1.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}

	.similar-albums-section {
		margin-top: 2.5rem;
		border-top: 2px solid var(--border-subtle);
		padding-top: 2rem;
	}

	.similar-albums-section h2 {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.similar-subtitle {
		margin: 0.25rem 0 1.25rem;
		color: var(--text-muted);
		font-size: 0.85rem;
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
		background: var(--surface-raised);
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
		background: var(--surface-canvas);
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

	.card-artist {
		color: var(--text-muted);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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

	@media (max-width: 42rem) {
		.album-header {
			align-items: start;
		}
	}
</style>
