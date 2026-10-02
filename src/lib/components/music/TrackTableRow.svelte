<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { Disc, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDuration, formatReleaseDate } from '#lib/format';
	import type { TrackSummary } from '#lib/tidal/models';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import type { TrackColumn } from './TrackTable.svelte';

	let {
		track,
		columns,
		isPlaying = false,
		onActivate,
		actions
	}: {
		track: TrackSummary;
		columns: TrackColumn[];
		isPlaying?: boolean;
		onActivate: () => void;
		actions?: Snippet;
	} = $props();

	let failedCover = $state<string | null>(null);

	const cols = $derived({
		album: columns.includes('album'),
		date: columns.includes('date'),
		duration: columns.includes('duration')
	});
	const cover = $derived(trackArtworkUrl(track, 80));
	const releaseYear = $derived(formatReleaseDate(track.album?.releaseDate));
	const title = $derived(track.title === track.id ? m.track_unavailable_title() : track.title);
	const artistLine = $derived(
		track.artists.filter((artist) => !artist.id || artist.name !== artist.id)
	);
	const albumTitle = $derived(
		track.album && track.album.title !== track.album.id ? track.album.title : null
	);
</script>

<div class:tt-row-playing={isPlaying} class="tt-row" role="row">
	<span class="tt-art" role="cell">
		{#if cover && cover !== failedCover}
			<img
				src={cover}
				alt=""
				loading="lazy"
				decoding="async"
				onerror={() => (failedCover = cover)}
			/>
		{:else}
			<span class="tt-art-fallback" aria-hidden="true"><Disc size={16} /></span>
		{/if}
		<button
			type="button"
			class="tt-play"
			onclick={onActivate}
			title={m.player_play_track()}
			aria-label={m.player_play_track()}
		>
			<Play size={14} fill="currentColor" />
		</button>
	</span>

	<span class="tt-main" role="cell">
		<a class="tt-title" href={resolve('/app/tracks/[id]', { id: track.id })}>{title}</a>
		<span class="tt-artists">
			{#each artistLine as artist, i (artist.id || i)}
				{#if artist.id}<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
					>{:else}<span>{artist.name}</span>{/if}{#if i < artistLine.length - 1},
				{/if}
			{/each}
			{#if albumTitle && (cols.album || cols.date)}
				<span class="tt-sub-album">
					· <span>{albumTitle}</span>{#if releaseYear}
						({releaseYear}){/if}
				</span>
			{/if}
		</span>
	</span>

	{#if cols.album}
		<span class="tt-album tt-hide-narrow" role="cell">
			{#if track.album?.id && albumTitle}
				<a href={resolve('/app/albums/[id]', { id: track.album.id })}>{albumTitle}</a>
			{:else if albumTitle}
				<span>{albumTitle}</span>
			{:else}
				<span class="tt-dash">—</span>
			{/if}
		</span>
	{/if}

	{#if cols.date}
		<span class="tt-date tt-num tt-hide-narrow" role="cell">
			{releaseYear || '—'}
		</span>
	{/if}

	{#if cols.duration}
		<span class="tt-time tt-num" role="cell">{formatDuration(track.duration) || '—'}</span>
	{/if}

	{#if actions}
		<span class="tt-actions" role="cell">{@render actions()}</span>
	{/if}
</div>

<style>
	.tt-row {
		display: grid;
		grid-template-columns: var(--tt-grid);
		align-items: center;
		gap: 0.85rem;
		padding: 0.5rem 0.9rem;
		border-bottom: 1px solid var(--border-subtle);
		transition: background-color 0.1s ease;
	}

	.tt-row:last-child {
		border-bottom: 0;
	}

	.tt-row:hover {
		background: var(--surface-selected);
	}

	.tt-row-playing {
		background: color-mix(in oklab, var(--action) 8%, var(--surface-raised));
	}

	.tt-row-playing .tt-title {
		color: var(--action);
	}

	.tt-art {
		position: relative;
		width: var(--tt-art-size, 2.75rem);
		aspect-ratio: 1;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
	}

	.tt-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.tt-art-fallback {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: var(--text-muted);
	}

	.tt-play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: var(--scrim);
		color: var(--scrim-ink);
		border: 0;
		opacity: 0;
		cursor: pointer;
		transition: opacity 0.12s ease;
	}

	.tt-art:hover .tt-play,
	.tt-play:focus-visible {
		opacity: 1;
	}

	.tt-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.tt-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text-primary);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tt-title:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.tt-artists {
		font-size: 0.76rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tt-artists a {
		color: inherit;
		text-decoration: none;
	}

	.tt-artists a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.tt-sub-album {
		display: none;
	}

	.tt-album {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tt-album a {
		color: inherit;
		text-decoration: none;
	}

	.tt-album a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.tt-num {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-align: right;
	}

	.tt-dash {
		color: var(--text-muted);
	}

	.tt-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	@container (max-width: 52rem) {
		.tt-row {
			grid-template-columns: var(--tt-grid-narrow);
		}
		.tt-hide-narrow {
			display: none;
		}

		.tt-sub-album {
			display: inline;
		}
	}
</style>
