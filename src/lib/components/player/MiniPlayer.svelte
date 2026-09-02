<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ChevronDown,
		ChevronUp,
		Disc,
		ExternalLink,
		ListMusic,
		SkipBack,
		SkipForward,
		X
	} from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	const tidalEmbedUrl = $derived(
		player.currentTrack
			? `https://embed.tidal.com/tracks/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);

	const tidalTrackUrl = $derived(
		player.currentTrack
			? `https://tidal.com/browse/track/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);
</script>

{#if player.currentTrack}
	<aside
		class="mini-player"
		class:expanded={player.isExpanded}
		aria-label="Now Playing"
		role="region"
	>
		<div class="player-bar">
			<div class="track-meta">
				{#if player.currentTrack.imageUrl}
					<img class="cover" src={player.currentTrack.imageUrl} alt="" aria-hidden="true" />
				{:else if player.currentTrack.album?.imageUrl}
					<img class="cover" src={player.currentTrack.album.imageUrl} alt="" aria-hidden="true" />
				{:else}
					<div class="cover cover-placeholder" aria-hidden="true"><Disc size={20} /></div>
				{/if}

				<div class="info">
					<a class="track-title" href={resolve('/app/tracks/[id]', { id: player.currentTrack.id })}>
						<strong>{player.currentTrack.title}</strong>
					</a>
					<p class="track-artist">
						{#each player.currentTrack.artists as artist, i (artist.id)}
							<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
							>{#if i < player.currentTrack.artists.length - 1},
							{/if}
						{/each}
					</p>
				</div>
			</div>

			<div class="playback-controls">
				<button
					type="button"
					class="control-btn"
					disabled={!player.hasPrevious}
					onclick={() => player.previous()}
					title={m.player_previous()}
					aria-label={m.player_previous()}
				>
					<SkipBack size={18} />
				</button>

				<button
					type="button"
					class="control-btn"
					disabled={!player.hasNext}
					onclick={() => player.next()}
					title={m.player_next()}
					aria-label={m.player_next()}
				>
					<SkipForward size={18} />
				</button>

				<a
					class="tidal-link"
					href={tidalTrackUrl}
					target="_blank"
					rel="noreferrer"
					title="Open in TIDAL"
					aria-label="Open in TIDAL"
				>
					<ExternalLink size={15} />
				</a>
			</div>

			<div class="player-actions">
				<button
					type="button"
					class="queue-btn"
					class:active={player.isQueueOpen}
					onclick={() => player.toggleQueue()}
					title={m.player_queue()}
					aria-label={m.player_queue()}
				>
					<ListMusic size={18} />
					{#if player.queueCount > 0}
						<span class="queue-counter">{player.queueCount}</span>
					{/if}
				</button>

				<button
					type="button"
					class="expand-btn"
					onclick={() => player.toggleExpanded()}
					title={player.isExpanded ? m.player_collapse() : m.player_expand()}
					aria-label={player.isExpanded ? m.player_collapse() : m.player_expand()}
				>
					{#if player.isExpanded}
						<ChevronDown size={18} />
					{:else}
						<ChevronUp size={18} />
					{/if}
				</button>

				<button
					type="button"
					class="close-btn"
					onclick={() => player.close()}
					title={m.player_close()}
					aria-label={m.player_close()}
				>
					<X size={18} />
				</button>
			</div>
		</div>

		{#if player.isExpanded}
			<div class="embed-container">
				<iframe
					title={`TIDAL player: ${player.currentTrack.title}`}
					src={tidalEmbedUrl}
					allow="autoplay; encrypted-media"
				></iframe>
			</div>
		{/if}
	</aside>
{/if}

<style>
	.mini-player {
		position: fixed;
		bottom: 1.25rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 80;
		width: calc(100% - 2rem);
		max-width: 48rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: 1rem;
		box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(12px);
		overflow: hidden;
		animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		transition: all 0.2s ease;
	}

	.player-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1rem;
		gap: 0.75rem;
	}

	.track-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
	}

	.cover {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.45rem;
		object-fit: cover;
		background: var(--surface-selected);
		flex: 0 0 auto;
	}

	.cover-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.info {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.track-title {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-title:hover {
		text-decoration: underline;
	}

	.track-artist {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-artist a {
		color: inherit;
		text-decoration: none;
	}

	.track-artist a:hover {
		text-decoration: underline;
	}

	.playback-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 0 0 auto;
	}

	.control-btn,
	.tidal-link,
	.queue-btn,
	.expand-btn,
	.close-btn {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.control-btn:hover:not(:disabled),
	.tidal-link:hover,
	.queue-btn:hover,
	.expand-btn:hover,
	.close-btn:hover {
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.control-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.player-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 0 0 auto;
	}

	.queue-btn {
		position: relative;
	}

	.queue-btn.active {
		color: var(--action);
		background: var(--surface-selected);
	}

	.queue-counter {
		position: absolute;
		top: 0.15rem;
		right: 0.15rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.2rem;
		border-radius: 9999px;
		background: var(--action);
		color: var(--action-contrast);
		font-size: 0.65rem;
		font-weight: 700;
	}

	.embed-container {
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.embed-container iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}

	@keyframes slideUp {
		from {
			transform: translate(-50%, 100%);
			opacity: 0;
		}
		to {
			transform: translate(-50%, 0);
			opacity: 1;
		}
	}

	@media (max-width: 40rem) {
		.mini-player {
			bottom: 4.5rem;
			width: calc(100% - 1rem);
		}
		.playback-controls .tidal-link {
			display: none;
		}
	}
</style>
