<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Mic, Play, Radio, Shuffle } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { ArtistDetail } from '#lib/tidal/models';
	import type { TidalPageState } from '#lib/tidal/page-state';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
	import MobileDetailRetry from './MobileDetailRetry.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

	let { artist, state }: { artist: ArtistDetail | null; state: TidalPageState | null } = $props();

	const TOP_TRACK_LIMIT = 10;
	const ALBUM_LIMIT = 12;

	const homeHref = resolve('/(mobile)/home');
	const settingsHref = resolve('/(mobile)/settings');

	const topTracks = $derived((artist?.topTracks ?? []).slice(0, TOP_TRACK_LIMIT));
	const albums = $derived((artist?.albums ?? []).slice(0, ALBUM_LIMIT));
	const radioTracks = $derived(artist?.radioTracks ?? []);
	const provenance = $derived(artist ? `${m.artist_label()} · ${artist.name}` : undefined);
	const isEmpty = $derived(Boolean(artist) && topTracks.length === 0 && albums.length === 0);

	function playTop(): void {
		if (!topTracks.length) return;
		player.play(topTracks[0], topTracks, provenance);
	}

	function shuffleTop(): void {
		if (!topTracks.length) return;
		player.shuffle = true;
		const index = Math.floor(Math.random() * topTracks.length);
		player.play(topTracks[index], topTracks, provenance, index);
	}

	function startRadio(): void {
		if (!radioTracks.length) return;
		player.play(radioTracks[0], radioTracks, m.artist_radio_title());
	}
</script>

{#if artist}
	<section class="artist-detail" aria-labelledby="artist-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			contextualBack
			backLabel={m.now_detail_back()}
			heading={artist.name}
			headingId="artist-detail-title"
		/>

		<div class="artist-hero">
			<span class="artist-avatar">
				{#if artist.imageUrl}
					<img src={artist.imageUrl} alt="" width="240" height="240" />
				{:else}
					<Mic size={44} strokeWidth={1.4} aria-hidden="true" />
				{/if}
			</span>
		</div>

		{#if isEmpty}
			<p class="notice">{m.now_artist_empty()}</p>
		{:else}
			<div class="artist-actions">
				<button type="button" class="primary" onclick={playTop} disabled={!topTracks.length}>
					<Play size={18} fill="currentColor" aria-hidden="true" />
					{m.player_play_all()}
				</button>
				<button
					type="button"
					onclick={shuffleTop}
					disabled={!topTracks.length}
					aria-label={m.now_artist_shuffle()}
				>
					<Shuffle size={18} aria-hidden="true" />
				</button>
				<button
					type="button"
					onclick={startRadio}
					disabled={!radioTracks.length}
					aria-label={m.player_start_radio()}
				>
					<Radio size={18} aria-hidden="true" />
				</button>
			</div>

			{#if topTracks.length}
				<section class="artist-section" aria-labelledby="artist-top-tracks">
					<h2 id="artist-top-tracks">{m.artist_top_tracks()}</h2>
					<ul class="artist-tracks">
						{#each topTracks as track, index (`${track.id}:${index}`)}
							<li>
								<MobileTrackRow
									{track}
									contextTracks={topTracks}
									contextIndex={index}
									{provenance}
									onActivate={() => player.play(track, topTracks, provenance, index)}
								></MobileTrackRow>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if albums.length}
				<section class="artist-section" aria-labelledby="artist-albums">
					<h2 id="artist-albums">{m.artist_albums()}</h2>
					<ul class="album-rail">
						{#each albums as album (album.id)}
							<li>
								<a class="album-card" href={resolve('/(mobile)/albums/[id]', { id: album.id })}>
									<span class="album-cover">
										{#if album.imageUrl}
											<img src={album.imageUrl} alt="" loading="lazy" />
										{:else}
											<Disc size={22} aria-hidden="true" />
										{/if}
									</span>
									<span class="album-title">{album.title}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<a class="more-link" href={resolve('/app/artists/[id]', { id: artist.id })}>
				{m.now_artist_more_desktop()}
			</a>
		{/if}

		<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</section>
{:else}
	<section class="artist-detail" aria-labelledby="artist-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			contextualBack
			backLabel={m.now_detail_back()}
			heading={m.artist_label()}
			headingId="artist-detail-title"
		/>
		{#if state === 'not_connected' || state === 'authorization_expired'}
			<div class="notice" role="status">
				<p>{m.now_artist_disconnected()}</p>
				<a class="notice-action" href={settingsHref}>{m.tidal_connect()}</a>
			</div>
		{:else if state === 'not_found' || state === 'invalid_id'}
			<div class="notice" role="status">
				<p>{m.now_artist_not_found()}</p>
				<a class="notice-action" href={homeHref}>{m.now_idle_cta()}</a>
			</div>
		{:else}
			<div class="notice" role="alert">
				<p>{m.now_artist_unavailable()}</p>
				<MobileDetailRetry />
			</div>
		{/if}
	</section>
{/if}

<style>
	.artist-detail {
		max-width: 44rem;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}

	.artist-hero {
		display: grid;
		justify-items: center;
	}

	.artist-avatar {
		display: grid;
		place-items: center;
		width: min(46vw, 12rem);
		aspect-ratio: 1;
		overflow: hidden;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: var(--surface-selected);
		box-shadow: 0 24px 42px -26px rgb(0 0 0 / 70%);
	}

	.artist-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.artist-actions {
		display: flex;
		gap: 0.5rem;
		margin: clamp(1.25rem, 5vw, 1.75rem) 0 0.5rem;
	}

	.artist-actions button {
		display: inline-flex;
		min-height: 3rem;
		min-width: 3rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.artist-actions .primary {
		flex: 1;
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.artist-actions button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.artist-actions button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.artist-section {
		margin-top: clamp(1.5rem, 6vw, 2.25rem);
	}

	.artist-section h2 {
		margin: 0 0 0.6rem;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.artist-tracks {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.album-rail {
		display: flex;
		gap: 0.75rem;
		margin: 0;
		padding: 0 0 0.25rem;
		list-style: none;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
	}

	.album-rail::-webkit-scrollbar {
		display: none;
	}

	.album-card {
		display: flex;
		width: 7rem;
		flex: none;
		flex-direction: column;
		gap: 0.4rem;
		color: inherit;
		text-decoration: none;
		scroll-snap-align: start;
	}

	.album-cover {
		display: grid;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-selected);
	}

	.album-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.album-title {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		color: var(--text-primary);
		font-size: var(--fs-xs);
		line-height: 1.25;
	}

	.album-card:focus-visible .album-cover {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.more-link {
		display: inline-block;
		margin-top: clamp(1.25rem, 5vw, 1.75rem);
		color: var(--action);
		font-size: var(--fs-sm);
		font-weight: 600;
	}

	.notice {
		margin-top: clamp(1.5rem, 6vw, 2.5rem);
		color: var(--text-muted);
	}

	.notice p {
		margin: 0 0 1rem;
	}

	.notice-action {
		display: inline-flex;
		min-height: 3rem;
		align-items: center;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--action);
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}

	.attribution {
		display: block;
		margin-top: clamp(1.5rem, 6vw, 2.5rem);
		color: var(--text-muted);
		font-size: var(--fs-xs);
	}
</style>
