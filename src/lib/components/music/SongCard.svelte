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
			onclick={() => player.addToQueue(track)}
			title={m.player_add_to_queue()}
			aria-label={m.player_add_to_queue()}
		>
			<ListPlus size={15} />
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
		gap: 0.85rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		position: relative;
		transition: all 120ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.song-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.artwork-wrap {
		position: relative;
		width: 4rem;
		height: 4rem;
		flex: 0 0 4rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		overflow: hidden;
	}

	.artwork {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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
		background: color-mix(in oklab, var(--action) 85%, black);
		color: #ffffff;
		border: 0;
		opacity: 0;
		cursor: pointer;
		transition: opacity 120ms ease;
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
		gap: 0.15rem;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.song-index {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.song-title {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.95rem;
		line-height: 1.25;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.song-title:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.song-artists {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 500;
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
		font-size: 0.75rem;
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
	}

	.song-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.15rem;
	}

	.song-duration {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 600;
	}

	.explicit-badge {
		border: 1px solid var(--border-strong);
		padding: 0 0.25rem;
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
		font-weight: 800;
	}

	.quality-badge {
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		color: var(--action);
		padding: 0 0.35rem;
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: all 120ms ease;
	}

	.action-btn:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.action-btn.play-btn:hover {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	@media (max-width: 36rem) {
		.song-card {
			padding: 0.65rem;
			gap: 0.65rem;
		}

		.artwork-wrap {
			width: 3.25rem;
			height: 3.25rem;
			flex: 0 0 3.25rem;
		}

		.external-btn {
			display: none;
		}
	}
</style>
