<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Check, FolderPlus, ListPlus, Music, Plus } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import Dialog from '#lib/components/ui/Dialog.svelte';

	interface Props {
		closeDelayMs?: number;
	}

	let { closeDelayMs = 800 }: Props = $props();

	const track = $derived(customPlaylists.selectedTrackForPlaylist);
	let newPlaylistTitle = $state('');
	let addedPlaylistId = $state<string | null>(null);
	let closeTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	const isOpen = $derived(track !== null);

	function clearCloseTimer() {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
	}

	function handleOpenChange(open: boolean) {
		if (!open) {
			clearCloseTimer();
			customPlaylists.closeAddToPlaylist();
			addedPlaylistId = null;
			newPlaylistTitle = '';
		}
	}

	function scheduleClose() {
		clearCloseTimer();
		closeTimer = setTimeout(() => {
			customPlaylists.closeAddToPlaylist();
			addedPlaylistId = null;
			closeTimer = null;
		}, closeDelayMs);
	}

	function handleCreateAndAdd() {
		if (!track || !newPlaylistTitle.trim()) return;
		const created = customPlaylists.createPlaylist(newPlaylistTitle.trim(), undefined, [track]);
		addedPlaylistId = created.id;
		newPlaylistTitle = '';
		scheduleClose();
	}

	function handleAddToExisting(playlistId: string) {
		if (!track) return;
		customPlaylists.addTrack(playlistId, track);
		addedPlaylistId = playlistId;
		scheduleClose();
	}

	$effect(() => {
		if (!isOpen) {
			clearCloseTimer();
		}
	});

	onDestroy(() => {
		clearCloseTimer();
	});
</script>

<Dialog
	open={isOpen}
	onOpenChange={handleOpenChange}
	title={m.playlist_dialog_title()}
	description={m.playlist_dialog_description()}
>
	{#snippet titleSnippet()}
		<div class="dialog-title-wrap">
			<ListPlus size={20} class="text-(--action)" />
			<h2 class="dialog-title">{m.playlist_dialog_title()}</h2>
		</div>
	{/snippet}

	{#if track}
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

		<div class="playlist-dialog-body">
			{#if customPlaylists.playlists.length > 0}
				<div class="playlists-list-section">
					<p class="section-label">{m.playlist_dialog_existing()}</p>
					<div class="playlists-list">
						{#each customPlaylists.playlists as playlist (playlist.id)}
							{@const isAdded = addedPlaylistId === playlist.id}
							{@const alreadyIn = playlist.items.some((t) => t.id === track.id)}
							<div class="playlist-row">
								<div class="playlist-meta">
									<strong class="truncate">{playlist.title}</strong>
									<span class="font-mono text-xs text-(--text-muted)">
										{playlist.items.length}
										{playlist.items.length === 1 ? 'track' : 'tracks'}
									</span>
								</div>
								<button
									type="button"
									class="add-btn"
									class:btn-added={isAdded || alreadyIn}
									disabled={isAdded || alreadyIn}
									onclick={() => handleAddToExisting(playlist.id)}
								>
									{#if isAdded}
										<Check size={14} /> {m.playlist_dialog_added()}
									{:else if alreadyIn}
										{m.playlist_dialog_in_playlist()}
									{:else}
										<Plus size={14} /> {m.playlist_dialog_add()}
									{/if}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="create-new-section">
				<p class="section-label">{m.playlist_dialog_new()}</p>
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
						placeholder={m.playlist_dialog_create_placeholder()}
						maxlength="60"
						class="playlist-name-input"
					/>
					<button type="submit" class="create-submit-btn" disabled={!newPlaylistTitle.trim()}>
						<FolderPlus size={14} />
						{m.playlist_dialog_create_action()}
					</button>
				</form>
			</div>
		</div>
	{/if}
</Dialog>

<style>
	.dialog-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.dialog-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--text-primary);
	}

	.track-preview {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1rem 1.4rem;
		background: var(--surface-canvas);
		border-bottom: 1px solid var(--border-subtle);
	}

	.preview-thumb {
		width: 3rem;
		height: 3rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xs, 4px);
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
		gap: 0.15rem;
	}

	.preview-info strong {
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-primary);
	}

	.preview-info span {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.playlist-dialog-body {
		padding: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		overflow-y: auto;
	}

	.section-label {
		margin: 0 0 0.55rem;
		font-family: ui-monospace, monospace;
		font-size: 0.725rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.playlists-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		max-height: 12rem;
		overflow-y: auto;
	}

	.playlist-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 10px);
		background: var(--surface-canvas);
		transition: all var(--dur-fast) ease;
	}

	.playlist-row:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.playlist-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.725rem;
		font-weight: 800;
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--dur-fast) ease;
	}

	.add-btn:hover:not(.btn-added) {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
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
		gap: 0.65rem;
	}

	.playlist-name-input {
		width: 100%;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		padding: 0.65rem 0.95rem;
		color: var(--text-primary);
		font: inherit;
		font-size: 0.85rem;
		transition: border-color var(--dur-fast) ease;
	}

	.playlist-name-input:focus {
		border-color: var(--action);
		outline: none;
	}

	.create-submit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.65rem 1.15rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all var(--dur-fast) ease;
	}

	.create-submit-btn:hover:not(:disabled) {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.create-submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
