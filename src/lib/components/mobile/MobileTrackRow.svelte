<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Disc } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import TrackActionMenu from '#lib/components/music/TrackActionMenu.svelte';

	let {
		track,
		onActivate,
		contextTracks,
		provenance,
		onStartRadio,
		radioDisabled = false,
		compact = false,
		actions
	}: {
		track: TrackSummary;
		onActivate: () => void;
		contextTracks?: TrackSummary[];
		provenance?: string;
		onStartRadio?: () => void | Promise<void>;
		radioDisabled?: boolean;
		/** Queue rows show full identity while leaving a narrow control column. */
		compact?: boolean;
		actions?: Snippet;
	} = $props();

	const cover = $derived(trackArtworkUrl(track, 80));
	let failedCover = $state<string | null>(null);
	const title = $derived(track.title === track.id ? m.track_unavailable_title() : track.title);
	const artistLine = $derived(
		track.artists
			.filter((artist) => !artist.id || artist.name !== artist.id)
			.map((artist) => artist.name)
			.join(', ')
	);
	const albumTitle = $derived(
		track.album && track.album.title !== track.album.id ? track.album.title : null
	);
</script>

<div class="mobile-track-row" class:compact class:with-actions={Boolean(actions)}>
	<button type="button" class="mobile-track-primary" onclick={onActivate}>
		<span class="mobile-track-art">
			{#if cover && cover !== failedCover}
				<img
					src={cover}
					alt=""
					loading="lazy"
					decoding="async"
					width="44"
					height="44"
					onerror={() => (failedCover = cover)}
				/>
			{:else}
				<Disc size={16} aria-hidden="true" />
			{/if}
		</span>
		<span class="mobile-track-copy">
			<span class="mobile-track-title">{title}</span>
			{#if artistLine}
				<span class="mobile-track-artist">{artistLine}</span>
			{/if}
			{#if compact && albumTitle}
				<span class="mobile-track-album">{albumTitle}</span>
			{/if}
		</span>
	</button>
	{#if actions}
		<div class="mobile-track-actions">
			{@render actions()}
		</div>
	{:else}
		<div class="mobile-track-actions">
			<TrackActionMenu
				mobile
				{track}
				{contextTracks}
				{provenance}
				{onStartRadio}
				{radioDisabled}
				triggerClass="mobile-action-btn"
			/>
		</div>
	{/if}
</div>

<style>
	.mobile-track-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 4rem;
		padding: 0.375rem;
		border-radius: var(--radius-md);
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.mobile-track-row:focus-within,
	.mobile-track-row:hover {
		background: color-mix(in oklab, var(--editorial-sky, var(--surface-selected)) 46%, transparent);
	}

	.mobile-track-art {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: none;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-selected);
		color: var(--text-muted);
	}

	.mobile-track-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mobile-track-primary {
		display: flex;
		min-width: 0;
		min-height: 3rem;
		flex: 1;
		align-items: center;
		gap: 0.75rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.mobile-track-copy {
		min-width: 0;
		flex: 1;
	}

	.mobile-track-title,
	.mobile-track-artist {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.compact {
		padding: 0.25rem;
	}

	.compact .mobile-track-primary {
		gap: 0.5rem;
	}

	.compact .mobile-track-art {
		width: 2rem;
		height: 2rem;
	}

	.compact .mobile-track-title,
	.compact .mobile-track-artist,
	.mobile-track-album {
		white-space: normal;
		overflow: visible;
		overflow-wrap: anywhere;
		line-height: 1.3;
	}

	.mobile-track-album {
		display: block;
		margin-top: 0.14rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.mobile-track-title {
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.mobile-track-artist {
		margin-top: 0.14rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		line-height: 1.3;
	}

	.mobile-track-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
	}

	.mobile-track-primary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	:global(.mobile-action-btn) {
		min-width: 2.75rem;
		min-height: 2.75rem;
	}
	@media (max-width: 24rem) {
		.with-actions:not(.compact) {
			flex-wrap: wrap;
		}
		.with-actions:not(.compact) .mobile-track-primary {
			flex-basis: 100%;
		}
		.with-actions:not(.compact) .mobile-track-actions {
			margin-left: auto;
		}
	}
</style>
