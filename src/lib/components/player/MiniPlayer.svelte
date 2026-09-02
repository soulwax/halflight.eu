<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ChevronDown,
		ChevronUp,
		Disc,
		ExternalLink,
		ListMusic,
		Search,
		SkipBack,
		SkipForward,
		Sparkles,
		X
	} from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
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

<aside
	class="mini-player"
	class:expanded={player.isExpanded && player.currentTrack}
	class:idle-dock={!player.currentTrack}
	aria-label="Audio Player"
	role="region"
>
	{#if player.currentTrack}
		<div class="player-bar">
			<div class="track-meta">
				{#if player.currentTrack.imageUrl}
					<img class="cover" src={player.currentTrack.imageUrl} alt="" aria-hidden="true" />
				{:else if player.currentTrack.album?.imageUrl}
					<img class="cover" src={player.currentTrack.album.imageUrl} alt="" aria-hidden="true" />
				{:else}
					<div class="cover cover-placeholder" aria-hidden="true"><Disc size={18} /></div>
				{/if}

				<div class="info">
					<a class="track-title" href={resolve('/app/tracks/[id]', { id: player.currentTrack.id })}>
						<strong>{player.currentTrack.title}</strong>
					</a>
					<p class="track-artist">
						{#if player.currentTrack.artists.length}
							{#each player.currentTrack.artists as artist, i (artist.id || i)}
								{#if artist.id}
									<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a>
								{:else}
									<span>{artist.name}</span>
								{/if}{#if i < player.currentTrack.artists.length - 1},
								{/if}
							{/each}
						{:else}
							<span>TIDAL Artist</span>
						{/if}
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
					<SkipBack size={16} />
				</button>

				<button
					type="button"
					class="control-btn"
					disabled={!player.hasNext}
					onclick={() => player.next()}
					title={m.player_next()}
					aria-label={m.player_next()}
				>
					<SkipForward size={16} />
				</button>

				<a
					class="control-btn tidal-link"
					href={tidalTrackUrl}
					target="_blank"
					rel="noreferrer"
					title="Open in TIDAL"
					aria-label="Open in TIDAL"
				>
					<ExternalLink size={14} />
				</a>
			</div>

			<div class="player-actions">
				<button
					type="button"
					class="control-btn queue-btn"
					class:active={player.isQueueOpen}
					onclick={() => player.toggleQueue()}
					title={m.player_queue()}
					aria-label={m.player_queue()}
				>
					<ListMusic size={16} />
					{#if player.queue.length > 0}
						<span class="queue-counter">{player.queue.length}</span>
					{/if}
				</button>

				<button
					type="button"
					class="control-btn expand-btn"
					onclick={() => (player.isExpanded = !player.isExpanded)}
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
					class="control-btn close-btn"
					onclick={() => player.close()}
					title={m.player_close()}
					aria-label={m.player_close()}
				>
					<X size={16} />
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
	{:else}
		<!-- Persistent Idle Dock: Visible to all users / empty accounts -->
		<div class="idle-bar">
			<div class="idle-engine-status">
				<span class="idle-indicator-dot"></span>
				<div class="flex flex-col">
					<span class="font-mono text-xs font-bold tracking-wider text-[var(--text-primary)]">
						SYN // AUDIO ENGINE
					</span>
					<span class="font-mono text-[0.65rem] text-[var(--text-muted)]"
						>READY // NO TRACK LOADED</span
					>
				</div>
			</div>

			<div class="idle-actions">
				<button type="button" class="compose-btn" onclick={() => customPlaylists.openGenerator()}>
					<Sparkles size={14} />
					COMPOSE PLAYLIST
				</button>

				<a class="idle-action-link" href={resolve('/app/search')}>
					<Search size={14} />
					SEARCH
				</a>

				<button
					type="button"
					class="control-btn queue-btn"
					class:active={player.isQueueOpen}
					onclick={() => player.toggleQueue()}
					title={m.player_queue()}
					aria-label={m.player_queue()}
				>
					<ListMusic size={16} />
				</button>
			</div>
		</div>
	{/if}
</aside>

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
		border: 2px solid var(--border-strong);
		box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.45);
		overflow: hidden;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		transition: all 0.15s ease;
	}

	.idle-dock {
		background: var(--surface-canvas);
	}

	.player-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.9rem;
		gap: 0.75rem;
	}

	.idle-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.9rem;
		gap: 0.75rem;
	}

	.idle-engine-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.idle-indicator-dot {
		width: 10px;
		height: 10px;
		background: var(--bauhaus-blue);
		box-shadow: 0 0 8px var(--bauhaus-blue);
	}

	.idle-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.compose-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		border: 2px solid var(--border-strong);
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.compose-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.idle-action-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		text-decoration: none;
		text-transform: uppercase;
		transition: all 0.12s ease;
	}

	.idle-action-link:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.track-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
	}

	.cover {
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--border-subtle);
		object-fit: cover;
		background: var(--surface-canvas);
		flex: 0 0 auto;
	}

	.cover-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.info {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.track-title {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-title:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.track-artist {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-artist a {
		color: inherit;
		text-decoration: none;
	}

	.track-artist a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.playback-controls {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 0 0 auto;
	}

	.control-btn {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.control-btn:hover:not(:disabled) {
		color: var(--text-primary);
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.control-btn:disabled {
		opacity: 0.3;
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
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.queue-counter {
		position: absolute;
		top: -0.25rem;
		right: -0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0.9rem;
		height: 0.9rem;
		padding: 0 0.15rem;
		background: var(--danger);
		color: #ffffff;
		font-family: ui-monospace, monospace;
		font-size: 0.6rem;
		font-weight: 800;
		border: 1px solid var(--border-strong);
	}

	.embed-container {
		border-top: 2px solid var(--border-strong);
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
		.idle-engine-status {
			display: none;
		}
	}
</style>
