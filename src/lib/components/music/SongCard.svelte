<script lang="ts">
	import { formatDuration, formatReleaseDate } from '#lib/format';
	import { m } from '#lib/paraglide/messages';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import Badge from '#lib/components/ui/Badge.svelte';
	import TrackActionMenu from './TrackActionMenu.svelte';
	import { resolve } from '$app/paths';
	import { Disc, Play } from '@lucide/svelte';

	let {
		track,
		contextTracks,
		index,
		provenance
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		index?: number;
		provenance?: string;
	} = $props();

	let imageError = $state(false);

	const coverImage = $derived(track.imageUrl ?? track.album?.imageUrl);
	const releaseYear = $derived(formatReleaseDate(track.album?.releaseDate));
</script>

<article class="song-card" aria-label={track.title}>
	<div class="artwork-wrap">
		{#if coverImage && !imageError}
			<img
				class="artwork"
				src={coverImage}
				alt={`Cover for ${track.title}`}
				loading="lazy"
				onerror={() => (imageError = true)}
			/>
		{:else}
			<div class="artwork artwork-placeholder" aria-hidden="true">
				<Disc size={28} />
			</div>
		{/if}
	</div>

	<div class="song-details">
		<div class="title-row">
			{#if index !== undefined}
				<span class="song-index">{String(index + 1).padStart(2, '0')}</span>
			{/if}
			<a class="song-title" href={resolve('/app/tracks/[id]', { id: track.id })}>
				<strong>{track.title}</strong>
			</a>
		</div>

		<p class="song-artists">
			{#if track.artists && track.artists.length > 0}
				{#each track.artists as artist, i (artist.id || i)}
					{#if artist.id}
						<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a>
					{:else}
						<span>{artist.name}</span>
					{/if}{#if i < track.artists.length - 1},
					{/if}
				{/each}
			{:else}
				<span class="text-(--text-muted)">TIDAL Artist</span>
			{/if}
		</p>

		{#if track.album}
			<p class="song-album">
				{#if track.album.id}
					<a href={resolve('/app/albums/[id]', { id: track.album.id })}>
						{track.album.title}
					</a>
				{:else}
					<span>{track.album.title}</span>
				{/if}
				{#if releaseYear}
					<span class="album-year font-mono">({releaseYear})</span>
				{/if}
			</p>
		{/if}

		<div class="song-meta">
			{#if track.duration}
				<time class="song-duration font-mono">{formatDuration(track.duration)}</time>
			{/if}

			{#if track.trackNumber}
				<span class="track-num-badge font-mono">#{track.trackNumber}</span>
			{/if}

			{#if track.explicit}
				<Badge variant="explicit" title={m.track_badge_explicit()} />
			{/if}

			{#if track.audioQuality}
				<Badge variant="quality" text={track.audioQuality} />
			{/if}

			{#if track.popularity !== undefined && track.popularity > 0}
				<span class="pop-badge font-mono" title={m.track_badge_popularity()}
					>{track.popularity}%</span
				>
			{/if}
		</div>
	</div>

	<div class="card-actions">
		<button
			type="button"
			class="action-btn play-btn"
			onclick={() => player.play(track, contextTracks, provenance)}
			title={m.player_play_track()}
			aria-label={m.player_play_track()}
		>
			<Play size={15} fill="currentColor" />
		</button>
		<TrackActionMenu {track} {contextTracks} {provenance} triggerClass="song-card-menu" />
	</div>
</article>

<style>
	.song-card {
		container-type: inline-size;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--line);
		background: var(--surface-raised);
		border-radius: var(--radius-md);
		box-shadow: none;
		position: relative;
		transition: all var(--dur-med) var(--ease-out);
	}

	.song-card:hover {
		border-color: color-mix(in oklab, var(--action) 45%, var(--line));
		box-shadow: var(--shadow-panel);
		transform: translateY(-1px);
	}

	.artwork-wrap {
		position: relative;
		width: clamp(3.75rem, 7vw, 4.5rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
	}

	.artwork {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		background: var(--surface-selected);
	}

	.artwork-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
		background: var(--surface-selected);
	}

	.song-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}

	.song-index {
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		flex: 0 0 auto;
	}

	.song-title {
		color: inherit;
		text-decoration: none;
		min-width: 0;
	}

	.song-title strong {
		font-size: 0.95rem;
		font-weight: 800;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
		letter-spacing: -0.01em;
	}

	.song-title:hover strong,
	.song-title:focus-visible strong {
		color: var(--action);
		text-decoration: underline;
	}

	.song-artists {
		margin: 0;
		font-size: 0.82rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.25;
	}

	.song-artists a {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
	}

	.song-artists a:hover,
	.song-artists a:focus-visible {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.song-album {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.song-album a {
		color: inherit;
		text-decoration: none;
	}

	.song-album a:hover,
	.song-album a:focus-visible {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.album-year {
		color: var(--text-muted);
		margin-left: 0.25rem;
		font-size: 0.72rem;
	}

	.song-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.2rem;
	}

	.song-duration {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.track-num-badge {
		color: var(--text-muted);
		font-size: 0.7rem;
		background: var(--surface-selected);
		padding: 0.15rem 0.45rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full, 9999px);
	}

	.pop-badge {
		color: var(--text-muted);
		font-size: 0.68rem;
		border: 1px solid var(--border-subtle);
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-full, 9999px);
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 0 0 auto;
	}

	.action-btn {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--action);
		background: var(--action);
		color: var(--action-contrast);
		border-radius: var(--radius-full);
		cursor: pointer;
		padding: 0;
		transition:
			transform var(--dur-fast) var(--ease-spring),
			filter var(--dur-fast) ease;
	}

	.action-btn:hover {
		filter: brightness(1.1);
		transform: scale(1.04);
	}

	.song-card :global(.song-card-menu) {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-full);
	}

	@media (max-width: 48rem) {
		.song-card {
			gap: 0.65rem;
			padding: 0.6rem;
		}
	}
</style>
