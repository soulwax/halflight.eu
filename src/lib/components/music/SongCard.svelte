<script lang="ts">
	import { resolve } from '$app/paths';
	import { Check, Disc, ExternalLink, ListPlus, Play, Plus } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { TrackSummary } from '#lib/server/tidal/models';

	let {
		track,
		contextTracks,
		index
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		index?: number;
	} = $props();

	let imageError = $state(false);
	let queuedFeedback = $state(false);

	function formatDuration(seconds?: number): string {
		if (!seconds) return '';
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}

	function formatQuality(quality?: string): string {
		if (!quality) return '';
		return quality.replaceAll('_', ' ');
	}

	function handleQueue() {
		player.addToQueue(track);
		queuedFeedback = true;
		setTimeout(() => {
			queuedFeedback = false;
		}, 1200);
	}

	const tidalTrackUrl = $derived(`https://tidal.com/browse/track/${encodeURIComponent(track.id)}`);
	const coverImage = $derived(track.imageUrl ?? track.album?.imageUrl);
	const releaseYear = $derived(
		track.album?.releaseDate ? track.album.releaseDate.slice(0, 4) : null
	);
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

		<button
			type="button"
			class="artwork-play-btn"
			onclick={() => player.play(track, contextTracks)}
			title={m.player_play_track()}
			aria-label={m.player_play_track()}
		>
			<Play size={16} fill="currentColor" />
		</button>
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
				<span class="text-[var(--text-muted)]">TIDAL Artist</span>
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
				<span class="explicit-badge" title="Explicit">E</span>
			{/if}

			{#if track.audioQuality}
				<span class="quality-badge">{formatQuality(track.audioQuality)}</span>
			{/if}

			{#if track.popularity !== undefined && track.popularity > 0}
				<span class="pop-badge font-mono" title="Popularity">{track.popularity}%</span>
			{/if}
		</div>
	</div>

	<div class="card-actions">
		<button
			type="button"
			class="action-btn play-btn"
			onclick={() => player.play(track, contextTracks)}
			title={m.player_play_track()}
			aria-label={m.player_play_track()}
		>
			<Play size={14} fill="currentColor" />
		</button>

		<button
			type="button"
			class="action-btn"
			class:action-btn-active={queuedFeedback}
			onclick={handleQueue}
			title={m.player_add_to_queue()}
			aria-label={m.player_add_to_queue()}
		>
			{#if queuedFeedback}
				<Check size={14} class="text-[var(--action)]" />
			{:else}
				<ListPlus size={15} />
			{/if}
		</button>

		<button
			type="button"
			class="action-btn"
			onclick={() => customPlaylists.promptAddToPlaylist(track)}
			title="Add to Custom Playlist"
			aria-label="Add to Custom Playlist"
		>
			<Plus size={15} />
		</button>

		<a
			class="action-btn external-btn"
			href={tidalTrackUrl}
			target="_blank"
			rel="noreferrer"
			title="Open in TIDAL"
			aria-label="Open in TIDAL"
		>
			<ExternalLink size={13} />
		</a>
	</div>
</article>

<style>
	.song-card {
		display: flex;
		align-items: center;
		gap: 1.15rem;
		padding: 0.95rem 1.15rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-md, 10px);
		position: relative;
		transition: all 140ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.song-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.artwork-wrap {
		position: relative;
		width: clamp(4.5rem, 9vw, 5.5rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
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

	.artwork-play-btn {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.55);
		color: #ffffff;
		border: 0;
		opacity: 0;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.artwork-wrap:hover .artwork-play-btn,
	.artwork-play-btn:focus-visible {
		opacity: 1;
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

	.explicit-badge {
		border: 1px solid var(--border-strong);
		padding: 0.1rem 0.4rem;
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.65rem;
		font-weight: 800;
		border-radius: var(--radius-xs, 4px);
	}

	.quality-badge {
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		padding: 0.15rem 0.5rem;
		color: var(--action);
		font-family: ui-monospace, monospace;
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		gap: 0.45rem;
		flex: 0 0 auto;
	}

	.action-btn {
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		border-radius: var(--radius-sm, 6px);
		cursor: pointer;
		padding: 0;
		text-decoration: none;
		transition: all 120ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.action-btn:hover {
		color: var(--text-primary);
		border-color: var(--border-strong);
		background: var(--surface-selected);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.action-btn-active {
		border-color: var(--action);
		background: var(--surface-selected);
	}

	.play-btn {
		background: var(--action);
		color: var(--action-contrast);
		border-color: var(--action);
	}

	.play-btn:hover {
		background: var(--action);
		color: var(--action-contrast);
		filter: brightness(1.1);
	}

	.external-btn:hover {
		color: var(--action);
	}

	@media (max-width: 48rem) {
		.song-card {
			gap: 0.65rem;
			padding: 0.6rem;
		}

		.external-btn {
			display: none;
		}
	}
</style>
