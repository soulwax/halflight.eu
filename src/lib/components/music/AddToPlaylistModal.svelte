<script lang="ts">
	import { Check, FolderPlus, ListPlus, Music, Plus, X } from '@lucide/svelte';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';

	const track = $derived(customPlaylists.selectedTrackForPlaylist);
	let newPlaylistTitle = $state('');
	let addedPlaylistId = $state<string | null>(null);

	function handleCreateAndAdd() {
		if (!track || !newPlaylistTitle.trim()) return;
		const created = customPlaylists.createPlaylist(newPlaylistTitle.trim(), undefined, [track]);
		addedPlaylistId = created.id;
		newPlaylistTitle = '';
		setTimeout(() => {
			customPlaylists.closeAddToPlaylist();
			addedPlaylistId = null;
		}, 800);
	}

	function handleAddToExisting(playlistId: string) {
		if (!track) return;
		customPlaylists.addTrack(playlistId, track);
		addedPlaylistId = playlistId;
		setTimeout(() => {
			customPlaylists.closeAddToPlaylist();
			addedPlaylistId = null;
		}, 800);
	}
</script>

{#if track}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={() => customPlaylists.closeAddToPlaylist()}></div>

	<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
		<header class="modal-header">
			<div class="title-wrap">
				<ListPlus size={20} class="text-[var(--action)]" />
				<h2 id="modal-title">ADD TO PLAYLIST</h2>
			</div>
			<button
				type="button"
				class="close-btn"
				onclick={() => customPlaylists.closeAddToPlaylist()}
				aria-label="Close"
			>
				<X size={18} />
			</button>
		</header>

		<div class="track-preview">
			{#if track.imageUrl}
				<img class="preview-thumb" src={track.imageUrl} alt="" aria-hidden="true" />
			{:else}
				<div class="preview-thumb thumb-placeholder" aria-hidden="true"><Music size={16} /></div>
			{/if}
			<div class="preview-info">
				<strong>{track.title}</strong>
				<span>{track.artists.map((a) => a.name).join(', ') || 'Unknown Artist'}</span>
			</div>
		</div>

		<div class="modal-body">
			{#if customPlaylists.playlists.length > 0}
				<div class="playlists-list-section">
					<p class="section-label">EXISTING PLAYLISTS</p>
					<div class="playlists-list">
						{#each customPlaylists.playlists as playlist (playlist.id)}
							{@const isAdded = addedPlaylistId === playlist.id}
							{@const alreadyIn = playlist.items.some((t) => t.id === track.id)}
							<div class="playlist-row">
								<div class="playlist-meta">
									<strong class="truncate">{playlist.title}</strong>
									<span class="font-mono text-xs text-[var(--text-muted)]"
										>{playlist.items.length} tracks</span
									>
								</div>
								<button
									type="button"
									class="add-btn"
									class:btn-added={isAdded || alreadyIn}
									disabled={isAdded || alreadyIn}
									onclick={() => handleAddToExisting(playlist.id)}
								>
									{#if isAdded}
										<Check size={14} /> ADDED
									{:else if alreadyIn}
										IN PLAYLIST
									{:else}
										<Plus size={14} /> ADD
									{/if}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="create-new-section">
				<p class="section-label">CREATE NEW PLAYLIST</p>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleCreateAndAdd();
					}}
					class="create-form"
				>
					<input
						type="text"
						bind:value={newPlaylistTitle}
						placeholder="Playlist title..."
						maxlength="60"
						class="playlist-name-input"
					/>
					<button type="submit" class="create-submit-btn" disabled={!newPlaylistTitle.trim()}>
						<FolderPlus size={14} />
						CREATE & ADD
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		z-index: 150;
		animation: fadeIn 0.15s ease;
	}

	.modal-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: calc(100% - 2rem);
		max-width: 28rem;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.4);
		z-index: 160;
		animation: scaleUp 0.15s ease;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 2px solid var(--border-subtle);
	}

	.title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.title-wrap h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.close-btn {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.close-btn:hover {
		border-color: var(--border-strong);
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.track-preview {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1.25rem;
		background: var(--surface-canvas);
		border-bottom: 1px solid var(--border-subtle);
	}

	.preview-thumb {
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--border-strong);
		object-fit: cover;
		background: var(--surface-selected);
	}

	.thumb-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.preview-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 0.1rem;
	}

	.preview-info strong {
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preview-info span {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.modal-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-height: 60vh;
		overflow-y: auto;
	}

	.section-label {
		margin: 0 0 0.5rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.playlists-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 12rem;
		overflow-y: auto;
	}

	.playlist-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.playlist-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid var(--action);
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.btn-added {
		border-color: var(--border-subtle);
		background: var(--surface-selected);
		color: var(--text-muted);
		cursor: default;
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.playlist-name-input {
		width: 100%;
		border: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		padding: 0.55rem 0.75rem;
		color: var(--text-primary);
		font: inherit;
		font-size: 0.85rem;
	}

	.playlist-name-input:focus {
		border-color: var(--action);
		outline: none;
	}

	.create-submit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.55rem 1rem;
		border: 2px solid var(--border-strong);
		background: var(--action);
		color: var(--action-contrast);
		font-weight: 800;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.create-submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes scaleUp {
		from {
			opacity: 0;
			transform: translate(-50%, -48%) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
</style>
