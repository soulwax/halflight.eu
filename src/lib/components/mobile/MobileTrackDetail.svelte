<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ListPlus, ListStart, Play, Radio } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDuration, formatReleaseDate } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackDetail } from '#lib/tidal/models';
	import type { TidalPageState } from '#lib/tidal/page-state';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';

	let { track, state }: { track: TrackDetail | null; state: TidalPageState | null } = $props();

	const homeHref = resolve('/(mobile)/home');
	const settingsHref = resolve('/(mobile)/settings');

	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const namedArtists = $derived(
		(track?.artists ?? []).filter((artist) => artist.name && artist.name !== artist.id)
	);
	const releaseYear = $derived(
		track?.album?.releaseDate ? formatReleaseDate(track.album.releaseDate) : ''
	);
	const duration = $derived(track?.duration ? formatDuration(track.duration) : '');
	const radioTracks = $derived(track?.radioTracks ?? []);

	function playNow(): void {
		if (track) player.play(track);
	}

	function startRadio(): void {
		if (!track || !radioTracks.length) return;
		player.play(radioTracks[0], radioTracks, m.player_radio_provenance({ title: track.title }));
	}
</script>

{#if track}
	<section class="track-detail" aria-labelledby="track-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			backLabel={m.now_detail_back()}
			heading={track.title}
			headingId="track-detail-title"
		/>

		<div class="track-hero">
			<span class="track-art">
				{#if cover}
					<img src={cover} alt="" width="320" height="320" />
				{:else}
					<Disc size={52} strokeWidth={1.4} aria-hidden="true" />
				{/if}
			</span>

			<p class="track-people">
				{#each namedArtists as artist, index (artist.id || index)}
					{#if artist.id}
						<a href={resolve('/(mobile)/artists/[id]', { id: artist.id })}>{artist.name}</a>
					{:else}
						<span>{artist.name}</span>
					{/if}{#if index < namedArtists.length - 1}<span aria-hidden="true">, </span>{/if}
				{/each}
			</p>

			{#if track.album}
				<p class="track-album">
					{#if track.album.id}
						<a href={resolve('/(mobile)/albums/[id]', { id: track.album.id })}
							>{track.album.title}</a
						>
					{:else}
						<span>{track.album.title}</span>
					{/if}
				</p>
			{/if}

			<p class="track-meta">
				{#if releaseYear}<span>{releaseYear}</span>{/if}
				{#if duration}<span>{duration}</span>{/if}
				{#if track.audioQuality}<span>{track.audioQuality}</span>{/if}
			</p>
		</div>

		<div class="track-actions">
			<button type="button" class="primary" onclick={playNow}>
				<Play size={18} fill="currentColor" aria-hidden="true" />
				{m.player_play_track()}
			</button>
			<button
				type="button"
				onclick={() => track && player.playNext(track)}
				aria-label={m.player_play_next()}
			>
				<ListStart size={18} aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={() => track && player.addToQueue(track)}
				aria-label={m.player_add_to_queue()}
			>
				<ListPlus size={18} aria-hidden="true" />
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

		<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</section>
{:else}
	<section class="track-detail" aria-labelledby="track-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			backLabel={m.now_detail_back()}
			heading={m.track_label()}
			headingId="track-detail-title"
		/>
		{#if state === 'not_connected' || state === 'authorization_expired'}
			<div class="notice" role="status">
				<p>{m.now_track_disconnected()}</p>
				<a class="notice-action" href={settingsHref}>{m.tidal_connect()}</a>
			</div>
		{:else if state === 'not_found' || state === 'invalid_id'}
			<div class="notice" role="status">
				<p>{m.now_track_not_found()}</p>
				<a class="notice-action" href={homeHref}>{m.now_idle_cta()}</a>
			</div>
		{:else}
			<div class="notice" role="alert">
				<p>{m.now_track_unavailable()}</p>
				<button type="button" class="notice-action" onclick={() => window.location.reload()}>
					{m.track_retry()}
				</button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.track-detail {
		max-width: 44rem;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}

	.track-hero {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		text-align: center;
	}

	.track-art {
		display: grid;
		place-items: center;
		width: min(64vw, 17rem);
		aspect-ratio: 1;
		margin-bottom: 0.5rem;
		overflow: hidden;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-selected);
		box-shadow: 0 24px 42px -26px rgb(0 0 0 / 70%);
	}

	.track-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.track-people,
	.track-album,
	.track-meta {
		margin: 0;
		font-size: var(--fs-sm);
	}

	.track-people a,
	.track-album a {
		color: var(--text-primary);
		font-weight: 600;
		text-decoration: none;
	}

	.track-people a:hover,
	.track-album a:hover,
	.track-people a:focus-visible,
	.track-album a:focus-visible {
		color: var(--action);
		text-decoration: underline;
	}

	.track-album a {
		color: var(--text-muted);
		font-weight: 500;
	}

	.track-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.15rem;
		color: var(--text-muted);
	}

	.track-meta span + span::before {
		margin-right: 0.5rem;
		content: '·';
	}

	.track-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: clamp(1.25rem, 5vw, 1.75rem);
	}

	.track-actions button {
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

	.track-actions .primary {
		flex: 1;
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.track-actions button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.track-actions button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
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
