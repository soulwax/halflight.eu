<script lang="ts">
	import { resolve } from '$app/paths';
	import { ExternalLink, ListPlus, Music, Play } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const retryHref = $derived(
		data.id ? resolve('/app/tracks/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalTrackUrl = $derived(
		data.track ? `https://tidal.com/browse/track/${encodeURIComponent(data.track.id)}` : ''
	);
	const tidalEmbedUrl = $derived(
		data.track ? `https://embed.tidal.com/tracks/${encodeURIComponent(data.track.id)}` : ''
	);

	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function formatQuality(quality: string): string {
		return quality.replaceAll('_', ' ');
	}
</script>

<svelte:head>
	<title>{data.track ? `${data.track.title} — Syn` : `${m.track_title()} — Syn`}</title>
	<meta
		name="description"
		content={data.track
			? m.track_description({ title: data.track.title })
			: m.track_description_empty()}
	/>
</svelte:head>

<section class="track-page" aria-labelledby="track-title">
	{#if data.track}
		<header class="track-header">
			{#if data.track.imageUrl}
				<img class="cover" src={data.track.imageUrl} alt={`Cover art for ${data.track.title}`} />
			{:else}
				<div class="cover cover-placeholder" aria-hidden="true"><Music size={40} /></div>
			{/if}
			<div class="heading">
				<p class="eyebrow">{m.track_label()}</p>
				<h1 id="track-title">{data.track.title}</h1>
				{#if data.track.artists.length}
					<p class="artist-line">
						{#each data.track.artists as artist, i (artist.id)}
							<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
							>{#if i < data.track.artists.length - 1},
							{/if}
						{/each}
					</p>
				{/if}
				{#if data.track.album}
					<p class="album-line">
						<a href={resolve('/app/albums/[id]', { id: data.track.album.id })}
							>{data.track.album.title}</a
						>
					</p>
				{/if}
			</div>
		</header>

		<section class="player" aria-label={`Play ${data.track.title} on TIDAL`}>
			<iframe
				title={`TIDAL player: ${data.track.title}`}
				src={tidalEmbedUrl}
				allow="autoplay; encrypted-media"
			></iframe>
		</section>

		<div class="track-layout">
			<section class="metadata-section" aria-labelledby="about-title">
				<h2 id="about-title">About this track</h2>
				<dl class="metadata">
					{#if data.track.artists.length}
						<div>
							<dt>{m.track_artists()}</dt>
							<dd>
								{#each data.track.artists as artist, i (artist.id)}
									<a class="meta-link" href={resolve('/app/artists/[id]', { id: artist.id })}
										>{artist.name}</a
									>{#if i < data.track.artists.length - 1},
									{/if}
								{/each}
							</dd>
						</div>
					{/if}

					{#if data.track.album}
						<div>
							<dt>{m.track_album()}</dt>
							<dd>
								<a class="meta-link" href={resolve('/app/albums/[id]', { id: data.track.album.id })}
									>{data.track.album.title}</a
								>
							</dd>
						</div>
					{/if}

					{#if data.track.copyright}
						<div>
							<dt>Copyright</dt>
							<dd>{data.track.copyright}</dd>
						</div>
					{/if}
					{#if data.track.isrc}
						<div>
							<dt>ISRC</dt>
							<dd>{data.track.isrc}</dd>
						</div>
					{/if}
				</dl>
			</section>

			<section class="facts" aria-label="Track details">
				{#if data.track.duration}<div>
						<span>Duration</span><strong>{formatDuration(data.track.duration)}</strong>
					</div>{/if}
				{#if data.track.trackNumber}<div>
						<span>Track</span><strong>{data.track.trackNumber}</strong>
					</div>{/if}
				{#if data.track.volumeNumber}<div>
						<span>Disc</span><strong>{data.track.volumeNumber}</strong>
					</div>{/if}
				{#if data.track.audioQuality}<div>
						<span>Quality</span><strong>{formatQuality(data.track.audioQuality)}</strong>
					</div>{/if}
				{#if data.track.popularity !== undefined}<div>
						<span>Popularity</span><strong>{data.track.popularity}</strong>
					</div>{/if}
				{#if data.track.explicit !== undefined}<div>
						<span>Content</span><strong>{data.track.explicit ? 'Explicit' : 'Clean'}</strong>
					</div>{/if}
			</section>
		</div>

		<div class="actions">
			<button type="button" class="syn-play-btn" onclick={() => player.play(data.track!)}>
				<Play size={16} fill="currentColor" />
				{m.player_play_track()}
			</button>
			<button type="button" class="syn-queue-btn" onclick={() => player.addToQueue(data.track!)}>
				<ListPlus size={16} />
				{m.player_add_to_queue()}
			</button>
			<a class="tidal-link" href={tidalTrackUrl} rel="noreferrer" target="_blank">
				<Play size={17} fill="currentColor" /> Open in TIDAL <ExternalLink size={15} />
			</a>
			<a class="back-link" href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</div>
	{:else if data.state === 'not_connected'}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_not_connected_title()}</h1>
			<p>{m.track_not_connected_description()}</p>
			{#if data.configured}
				<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
			{:else}
				<p>{m.tidal_not_configured()}</p>
			{/if}
		</section>
	{:else if data.state === 'authorization_expired'}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_authorization_expired_title()}</h1>
			<p>{m.track_authorization_expired_description()}</p>
			<a href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if data.state === 'not_found' || data.state === 'invalid_id'}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_not_found_title()}</h1>
			<p>{m.track_not_found_description()}</p>
			<a href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</section>
	{:else}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_unavailable_title()}</h1>
			<p role="alert">{m.track_unavailable_description()}</p>
			<a href={retryHref}>{m.track_retry()}</a>
		</section>
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.track-page {
		max-width: 72rem;
	}

	h1,
	p,
	dd {
		margin-top: 0;
	}

	.track-header {
		display: flex;
		align-items: end;
		gap: clamp(1rem, 3vw, 2rem);
	}
	.cover {
		width: clamp(8rem, 19vw, 13rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border-radius: 0.5rem;
		background: var(--surface-selected);
		object-fit: cover;
		box-shadow: var(--shadow-raised);
	}
	.cover-placeholder {
		display: grid;
		place-items: center;
	}
	.heading {
		min-width: 0;
	}
	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1 {
		margin-bottom: 0;
		overflow-wrap: anywhere;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}
	.artist-line,
	.album-line {
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
	}
	.artist-line {
		font-size: 1.1rem;
		font-weight: 700;
	}
	.artist-line a,
	.album-line a,
	.meta-link {
		color: inherit;
		text-decoration: none;
	}
	.artist-line a:hover,
	.artist-line a:focus-visible,
	.album-line a:hover,
	.album-line a:focus-visible,
	.meta-link:hover,
	.meta-link:focus-visible {
		text-decoration: underline;
	}
	.album-line {
		color: var(--text-muted);
	}

	.player {
		margin-top: 2rem;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		background: var(--surface-raised);
	}
	.player iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}
	.track-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.7fr);
		gap: 1rem;
		margin-top: 1rem;
	}
	.metadata-section,
	.facts {
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		background: var(--surface-raised);
	}
	.metadata-section {
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}
	.metadata-section h2 {
		margin: 0 0 1rem;
		font-size: 1.1rem;
	}

	.metadata,
	.state-card {
		margin-top: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.metadata {
		margin: 0;
		border: 0;
		border-radius: 0;
		background: none;
		padding: 0;
		display: grid;
		gap: 1rem;
	}

	.metadata div {
		display: grid;
		gap: 0.25rem;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 700;
	}

	dd {
		margin-bottom: 0;
		font-size: 1.1rem;
		overflow-wrap: anywhere;
	}
	.facts {
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.facts div {
		display: grid;
		min-height: 5rem;
		align-content: center;
		gap: 0.35rem;
		padding: 1rem;
		border-right: 1px solid var(--border-subtle);
		border-bottom: 1px solid var(--border-subtle);
	}
	.facts div:nth-child(2n) {
		border-right: 0;
	}
	.facts div:nth-last-child(-n + 2) {
		border-bottom: 0;
	}
	.facts span {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
	}
	.facts strong {
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.syn-play-btn {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1.15rem;
		color: var(--action-contrast);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.syn-play-btn:hover {
		opacity: 0.9;
	}

	.syn-queue-btn {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		background: var(--surface-raised);
		padding: 0.75rem 1rem;
		color: var(--text-primary);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.syn-queue-btn:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.tidal-link {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.4rem;
		border-radius: 0.75rem;
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		padding: 0.75rem 1rem;
		color: var(--text-primary);
		font-weight: 700;
		text-decoration: none;
	}

	.tidal-link:hover {
		border-color: var(--border-strong);
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
		.track-header {
			align-items: start;
		}
		.track-layout {
			grid-template-columns: 1fr;
		}
		.player iframe {
			height: 10.75rem;
		}
	}
</style>
