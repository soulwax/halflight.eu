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

	<div class="queue-drawer" aria-labelledby="queue-heading" role="dialog" aria-modal="true">
		<header class="queue-header">
			<div class="queue-title-group">
				<ListMusic size={20} class="text-[var(--action)]" />
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
					<X size={16} />
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
							<div class="track-thumb thumb-placeholder"><Disc size={16} /></div>
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
								<span class="queue-index">{String(index + 1).padStart(2, '0')}</span>

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
										<Play size={13} fill="currentColor" />
									</button>
									<button
										type="button"
										class="icon-action-btn icon-delete-btn"
										onclick={() => player.removeFromQueue(index)}
										title={m.player_remove_from_queue()}
										aria-label={m.player_remove_from_queue()}
									>
										<Trash2 size={13} />
									</button>
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		</div>
	</div>
{/if}

<style>
	.queue-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		z-index: 90;
		animation: fadeIn 0.15s ease;
	}

	.queue-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		max-width: 26rem;
		background: var(--surface-raised);
		border-left: 2px solid var(--border-strong);
		box-shadow: -4px 0px 0px rgba(0, 0, 0, 0.4);
		z-index: 100;
		display: flex;
		flex-direction: column;
		animation: slideLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.queue-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.15rem 1.25rem;
		border-bottom: 2px solid var(--border-subtle);
	}

	.queue-title-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.queue-title-group h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}

	.queue-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.35rem;
		height: 1.35rem;
		padding: 0 0.3rem;
		border: 1px solid var(--border-strong);
		background: var(--surface-selected);
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		font-weight: 800;
	}

	.queue-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.clear-btn {
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		cursor: pointer;
		padding: 0.35rem 0.6rem;
		transition: all 0.12s ease;
	}

	.clear-btn:hover {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-subtle);
	}

	.close-btn {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.close-btn:hover {
		color: var(--text-primary);
		border-color: var(--border-strong);
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
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.track-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.6rem 0.75rem;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		transition: all 0.12s ease;
	}

	.track-item:hover {
		border-color: var(--border-strong);
	}

	.current-track-item {
		border-left: 3px solid var(--action);
		background: var(--surface-selected);
	}

	.track-thumb {
		width: 2.5rem;
		height: 2.5rem;
		flex: 0 0 auto;
		border: 1px solid var(--border-subtle);
		object-fit: cover;
		background: var(--surface-canvas);
	}

	.thumb-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.queue-index {
		font-family: ui-monospace, monospace;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		width: 1.3rem;
		text-align: center;
		flex: 0 0 auto;
	}

	.track-info {
		min-width: 0;
		flex: 1;
		display: grid;
		gap: 0.1rem;
	}

	.track-title-link {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-title-link:hover {
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

	.track-time {
		font-family: ui-monospace, monospace;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 600;
		flex: 0 0 auto;
	}

	.item-actions {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex: 0 0 auto;
	}

	.icon-action-btn {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.icon-action-btn:hover {
		color: var(--action);
		border-color: var(--action);
		background: var(--surface-selected);
	}

	.icon-delete-btn:hover {
		color: var(--danger);
		border-color: var(--danger);
	}

	.empty-notice {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
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
