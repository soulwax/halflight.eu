<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ListMusic, Play, Trash2, X } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	function formatDuration(seconds?: number): string {
		if (!seconds) return '';
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			player.closeQueue();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if player.isQueueOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="queue-backdrop" onclick={() => player.closeQueue()}></div>

	<aside class="queue-drawer" aria-labelledby="queue-heading" role="dialog" aria-modal="true">
		<header class="queue-header">
			<div class="queue-title-group">
				<ListMusic size={22} class="text-[var(--action)]" />
				<h2 id="queue-heading">{m.player_queue()}</h2>
				{#if player.queueCount > 0}
					<span class="queue-badge">{player.queueCount}</span>
				{/if}
			</div>

			<div class="queue-actions">
				{#if player.queueCount > 0}
					<button
						type="button"
						class="clear-btn"
						onclick={() => player.clearQueue()}
						title={m.player_clear_queue()}
					>
						{m.player_clear_queue()}
					</button>
				{/if}
				<button
					type="button"
					class="close-btn"
					onclick={() => player.closeQueue()}
					aria-label="Close queue"
				>
					<X size={18} />
				</button>
			</div>
		</header>

		<div class="queue-content">
			{#if player.currentTrack}
				<section class="now-playing-section" aria-labelledby="now-playing-heading">
					<p id="now-playing-heading" class="section-label">{m.player_now_playing()}</p>
					<div class="track-item current-track-item">
						{#if player.currentTrack.imageUrl}
							<img
								class="track-thumb"
								src={player.currentTrack.imageUrl}
								alt=""
								aria-hidden="true"
							/>
						{:else if player.currentTrack.album?.imageUrl}
							<img
								class="track-thumb"
								src={player.currentTrack.album.imageUrl}
								alt=""
								aria-hidden="true"
							/>
						{:else}
							<div class="track-thumb thumb-placeholder"><Disc size={18} /></div>
						{/if}

						<div class="track-info">
							<a
								class="track-title-link"
								href={resolve('/app/tracks/[id]', { id: player.currentTrack.id })}
								onclick={() => player.closeQueue()}
							>
								<strong>{player.currentTrack.title}</strong>
							</a>
							<p class="track-artist">
								{#each player.currentTrack.artists as artist, i (artist.id)}
									<a
										href={resolve('/app/artists/[id]', { id: artist.id })}
										onclick={() => player.closeQueue()}
									>
										{artist.name}
									</a>{#if i < player.currentTrack.artists.length - 1},
									{/if}
								{/each}
							</p>
						</div>

						{#if player.currentTrack.duration}
							<time class="track-time">{formatDuration(player.currentTrack.duration)}</time>
						{/if}
					</div>
				</section>
			{/if}

			<section class="next-up-section" aria-labelledby="next-up-heading">
				<p id="next-up-heading" class="section-label">{m.player_next_up()}</p>

				{#if player.queue.length === 0}
					<p class="empty-notice">{m.player_queue_empty()}</p>
				{:else}
					<ol class="queue-list">
						{#each player.queue as track, index (track.id + '-' + index)}
							<li class="track-item">
								<span class="queue-index">{index + 1}</span>

								<div class="track-info">
									<a
										class="track-title-link"
										href={resolve('/app/tracks/[id]', { id: track.id })}
										onclick={() => player.closeQueue()}
									>
										<strong>{track.title}</strong>
									</a>
									<p class="track-artist">
										{#each track.artists as artist, i (artist.id)}
											<a
												href={resolve('/app/artists/[id]', { id: artist.id })}
												onclick={() => player.closeQueue()}
											>
												{artist.name}
											</a>{#if i < track.artists.length - 1},
											{/if}
										{/each}
									</p>
								</div>

								{#if track.duration}
									<time class="track-time">{formatDuration(track.duration)}</time>
								{/if}

								<div class="item-actions">
									<button
										type="button"
										class="icon-action-btn"
										onclick={() => player.playFromQueue(index)}
										title={m.player_play_track()}
										aria-label={m.player_play_track()}
									>
										<Play size={14} fill="currentColor" />
									</button>
									<button
										type="button"
										class="icon-action-btn icon-delete-btn"
										onclick={() => player.removeFromQueue(index)}
										title={m.player_remove_from_queue()}
										aria-label={m.player_remove_from_queue()}
									>
										<Trash2 size={14} />
									</button>
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		</div>
	</aside>
{/if}

<style>
	.queue-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		animation: fadeIn 0.15s ease-out;
	}

	.queue-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 100;
		display: flex;
		width: 100%;
		max-width: 26rem;
		flex-direction: column;
		background: var(--surface-raised);
		border-left: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-overlay, 0 10px 30px rgba(0, 0, 0, 0.5));
		animation: slideLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.queue-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.25rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.queue-title-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.queue-title-group h2 {
		margin: 0;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.queue-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.35rem;
		border-radius: 9999px;
		background: var(--surface-selected);
		color: var(--text-primary);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.queue-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.clear-btn {
		border: 0;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.35rem 0.6rem;
		border-radius: 0.4rem;
	}

	.clear-btn:hover {
		color: var(--danger);
		background: var(--surface-selected);
	}

	.close-btn {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.close-btn:hover {
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.queue-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section-label {
		margin: 0 0 0.6rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.track-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem;
		border-radius: 0.65rem;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		transition: background 0.15s ease;
	}

	.current-track-item {
		border-color: color-mix(in oklab, var(--action), var(--border-subtle) 40%);
		background: color-mix(in oklab, var(--action), transparent 93%);
	}

	.track-thumb {
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 auto;
		border-radius: 0.4rem;
		object-fit: cover;
		background: var(--surface-selected);
	}

	.thumb-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.queue-index {
		color: var(--text-muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		width: 1.2rem;
		text-align: center;
		flex: 0 0 auto;
	}

	.track-info {
		min-width: 0;
		flex: 1;
		display: grid;
		gap: 0.15rem;
	}

	.track-title-link {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-title-link:hover {
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

	.track-time {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		flex: 0 0 auto;
	}

	.item-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 0 0 auto;
	}

	.icon-action-btn {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.icon-action-btn:hover {
		color: var(--action);
		background: var(--surface-selected);
	}

	.icon-delete-btn:hover {
		color: var(--danger);
	}

	.empty-notice {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-style: italic;
		padding: 1rem 0;
	}

	.queue-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideLeft {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}
</style>
