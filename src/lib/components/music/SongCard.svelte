<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ExternalLink, ListPlus, Play } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
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

	const tidalTrackUrl = $derived(`https://tidal.com/browse/track/${encodeURIComponent(track.id)}`);
	const coverImage = $derived(track.imageUrl ?? track.album?.imageUrl);
</script>

<article class="song-card" aria-label={track.title}>
	<div class="artwork-wrap">
		{#if coverImage}
			<img class="artwork" src={coverImage} alt="" loading="lazy" />
		{:else}
			<div class="artwork artwork-placeholder" aria-hidden="true">
				<Disc size={32} />
			</div>
		{/if}

		<button
			type="button"
			class="artwork-play-btn"
			onclick={() => player.play(track, contextTracks)}
			title={m.player_play_track()}
			aria-label={m.player_play_track()}
		>
			<Play size={18} fill="currentColor" />
		</button>
	</div>

	<div class="song-details">
		<div class="title-row">
			{#if index !== undefined}
				<span class="song-index">{index + 1}</span>
			{/if}
			<a class="song-title" href={resolve('/app/tracks/[id]', { id: track.id })}>
				<strong>{track.title}</strong>
			</a>
		</div>

		{#if track.artists.length}
			<p class="song-artists">
				{#each track.artists as artist, i (artist.id)}
					<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
					>{#if i < track.artists.length - 1},
					{/if}
				{/each}
			</p>
		{/if}

		{#if track.album}
			<p class="song-album">
				<a href={resolve('/app/albums/[id]', { id: track.album.id })}>{track.album.title}</a>
			</p>
		{/if}

		<div class="song-meta">
			{#if track.duration}
				<time class="song-duration">{formatDuration(track.duration)}</time>
			{/if}

			{#if track.explicit}
				<span class="explicit-badge" title="Explicit">E</span>
			{/if}

			{#if track.audioQuality}
				<span class="quality-badge">{formatQuality(track.audioQuality)}</span>
			{/if}
		</div>
	</div>

	<div class="card-actions">
		<button
			type="button"
			class="action-btn"
			onclick={() => player.play(track, contextTracks)}
			title={m.player_play_track()}
			aria-label={m.player_play_track()}
		>
			<Play size={15} fill="currentColor" />
		</button>

		<button
			type="button"
			class="action-btn"
			onclick={() => player.addToQueue(track)}
			title={m.player_add_to_queue()}
			aria-label={m.player_add_to_queue()}
		>
			<ListPlus size={16} />
		</button>

		<a
			class="action-btn"
			href={tidalTrackUrl}
			target="_blank"
			rel="noreferrer"
			title="Open in TIDAL"
			aria-label="Open in TIDAL"
		>
			<ExternalLink size={14} />
		</a>
	</div>
</article>

<style>
	.song-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1rem;
		background: var(--surface-canvas);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
	}

	.song-card:hover {
		border-color: var(--border-strong);
		background: var(--surface-raised);
		transform: translateY(-1px);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
	}

	.artwork-wrap {
		position: relative;
		width: 4.25rem;
		height: 4.25rem;
		flex: 0 0 4.25rem;
		border-radius: 0.65rem;
		overflow: hidden;
		background: var(--surface-selected);
	}

	.artwork {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.2s ease;
	}

	.song-card:hover .artwork {
		transform: scale(1.05);
	}

	.artwork-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.artwork-play-btn {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.5);
		color: #ffffff;
		border: 0;
		opacity: 0;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.song-card:hover .artwork-play-btn,
	.artwork-play-btn:focus-visible {
		opacity: 1;
	}

	.song-details {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.song-index {
		color: var(--text-muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.song-title {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 1rem;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.song-title:hover {
		text-decoration: underline;
	}

	.song-artists {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.song-artists a {
		color: inherit;
		text-decoration: none;
	}

	.song-artists a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.song-album {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.song-album a {
		color: inherit;
		text-decoration: none;
	}

	.song-album a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.song-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}

	.song-duration {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.explicit-badge {
		border-radius: 0.25rem;
		background: var(--surface-selected);
		padding: 0.05rem 0.35rem;
		color: var(--text-muted);
		font-size: 0.65rem;
		font-weight: 700;
	}

	.quality-badge {
		border-radius: 0.25rem;
		background: color-mix(in oklab, var(--action), transparent 85%);
		color: var(--action);
		padding: 0.05rem 0.35rem;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 0 0 auto;
	}

	.action-btn {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.6rem;
		background: var(--surface-raised);
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	@media (max-width: 36rem) {
		.song-card {
			padding: 0.75rem;
			gap: 0.75rem;
		}

		.artwork-wrap {
			width: 3.5rem;
			height: 3.5rem;
			flex: 0 0 3.5rem;
		}

		.card-actions a {
			display: none;
		}
	}
</style>
