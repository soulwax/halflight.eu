<script lang="ts">
	import PageActions from '#lib/components/music/PageActions.svelte';
	import PageHeader from '#lib/components/music/PageHeader.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import TrackTable from '#lib/components/music/TrackTable.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { downloadM3u8File, generateM3u8 } from '#lib/utils/m3u';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Check, Download, Edit3, Loader2, Play, RefreshCw, Trash2, X } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isEditing = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let isSaving = $state(false);

	let isDeleting = $state(false);
	let deleteTidalToo = $state(false);
	let isDeletePending = $state(false);

	let isSyncing = $state(false);
	let syncFeedback = $state<string | null>(null);

	const retryHref = $derived(
		data.id ? resolve('/app/playlists/[id]', { id: data.id }) : resolve('/app/search')
	);

	const tidalPlaylistId = $derived(
		data.localPlaylist?.tidalPlaylistId ||
			(!data.isLocal && data.playlist ? data.playlist.id : null)
	);

	const tidalPlaylistUrl = $derived(
		tidalPlaylistId
			? `https://tidal.com/browse/playlist/${encodeURIComponent(tidalPlaylistId)}`
			: ''
	);

	function formatTotalDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours} hr ${minutes} min`;
		return `${minutes} min`;
	}

	function startEdit() {
		if (!data.playlist) return;
		editTitle = data.playlist.title;
		editDescription = data.playlist.description || '';
		isEditing = true;
	}

	async function saveEdit() {
		if (!data.playlist || !editTitle.trim()) return;
		isSaving = true;
		try {
			const res = await fetch(`/api/playlists/${encodeURIComponent(data.playlist.id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle.trim(),
					description: editDescription.trim() || null
				})
			});
			if (res.ok) {
				isEditing = false;
				await customPlaylists.syncWithServer();
				window.location.reload();
			}
		} catch {
			// error saving
		} finally {
			isSaving = false;
		}
	}

	async function handleSync() {
		if (!data.playlist) return;
		isSyncing = true;
		syncFeedback = null;
		try {
			let payload: Record<string, string> = { action: 'push', playlistId: data.playlist.id };

			if (!data.isLocal && tidalPlaylistId) {
				// Pull into local Syn
				payload = { action: 'pull', tidalPlaylistId };
			}

			const res = await fetch('/api/playlists/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				syncFeedback = m.playlist_synced();
				await customPlaylists.syncWithServer();
				setTimeout(() => {
					window.location.reload();
				}, 600);
			} else {
				const err = await res.json().catch(() => ({}));
				syncFeedback = err.message || m.playlist_sync_error();
			}
		} catch (err) {
			syncFeedback = err instanceof Error ? err.message : m.playlist_sync_error();
		} finally {
			isSyncing = false;
		}
	}

	async function confirmDelete() {
		if (!data.playlist) return;
		isDeletePending = true;
		try {
			const deleted = await customPlaylists.deletePlaylist(data.playlist.id);
			if (!deleted) {
				isDeletePending = false;
				return;
			}

			if (deleteTidalToo && tidalPlaylistId) {
				// Delete from TIDAL too
				await fetch(`/api/playlists/sync`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'delete_remote', tidalPlaylistId })
				}).catch(() => {});
			}

			await goto(resolve('/app/library'));
		} catch {
			isDeletePending = false;
		}
	}
</script>

<svelte:head>
	<title
		>{data.playlist
			? `${data.playlist.title} — ${m.brand_name()}`
			: `${m.playlist_title()} — ${m.brand_name()}`}</title
	>
	<meta
		name="description"
		content={data.playlist
			? m.playlist_description({ title: data.playlist.title })
			: m.playlist_description_empty()}
	/>
</svelte:head>

<section class="playlist-page" aria-labelledby="playlist-title">
	{#if data.playlist}
		{#if isEditing}
			<div class="edit-panel">
				<div class="edit-field">
					<label for="edit-title">Title</label>
					<input id="edit-title" class="edit-input" type="text" bind:value={editTitle} />
				</div>
				<div class="edit-field">
					<label for="edit-desc">Description</label>
					<textarea id="edit-desc" class="edit-textarea" rows="2" bind:value={editDescription}
					></textarea>
				</div>
				<div class="edit-actions">
					<Button variant="secondary" onclick={() => (isEditing = false)} disabled={isSaving}>
						{m.playlist_cancel()}
					</Button>
					<Button variant="primary" onclick={saveEdit} disabled={isSaving || !editTitle.trim()}>
						{#if isSaving}
							<Loader2 size={14} class="animate-spin" />
						{/if}
						{m.playlist_save()}
					</Button>
				</div>
			</div>
		{:else}
			<PageHeader
				title={data.playlist.title}
				imageUrl={data.playlist.imageUrl}
				eyebrow="HALFLIGHT // CURATED PLAYLIST"
				type="playlist"
			>
				{#if data.playlist.description}
					<p class="line-clamp-2 text-sm text-(--text-muted)">{data.playlist.description}</p>
				{/if}
				<div class="meta-line">
					{#if data.playlist.creator}
						<span class="font-bold"
							>{m.playlist_by({ creator: data.playlist.creator.name ?? 'TIDAL' })}</span
						>
						<span>·</span>
					{/if}
					{#if data.playlist.numberOfItems || data.playlist.items.length}
						<span class="font-mono"
							>{data.playlist.numberOfItems ?? data.playlist.items.length}
							{m.playlist_track_count()}</span
						>
					{/if}
					{#if data.playlist.duration}
						<span>·</span>
						<span class="font-mono">{formatTotalDuration(data.playlist.duration)}</span>
					{/if}

					<!-- Sync status badge -->
					{#if data.syncStatus === 'synced'}
						<span class="status-pill pill-green">
							<Check size={11} />
							{m.playlist_synced()}
						</span>
					{:else if data.syncStatus === 'pending_push'}
						<span class="status-pill pill-amber">
							<RefreshCw size={11} />
							{m.playlist_pending_push()}
						</span>
					{:else if data.syncStatus === 'error'}
						<span class="status-pill pill-red">
							{m.playlist_sync_error()}
						</span>
					{:else if data.isLocal && !tidalPlaylistId}
						<span class="status-pill pill-gray">
							{m.playlist_local_only()}
						</span>
					{/if}
				</div>

				{#snippet actions()}
					{#if data.playlist?.items.length}
						<Button
							variant="primary"
							onclick={() => player.play(data.playlist!.items[0], data.playlist!.items)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>

						<Button
							variant="secondary"
							onclick={() => {
								if (!data.playlist) return;
								const m3uContent = generateM3u8(data.playlist.title, data.playlist.items);
								downloadM3u8File(`${data.playlist.title}.m3u8`, m3uContent);
							}}
							title={m.action_export_m3u8()}
							ariaLabel="Export as M3U8 Playlist"
						>
							<Download size={14} />
							M3U8
						</Button>
					{/if}

					<!-- Sync with TIDAL button -->
					{#if data.isLocal || tidalPlaylistId}
						<Button
							variant="secondary"
							disabled={isSyncing}
							onclick={handleSync}
							title={m.playlist_sync()}
						>
							<RefreshCw size={14} class={isSyncing ? 'animate-spin' : ''} />
							{isSyncing ? m.playlist_syncing() : m.playlist_sync()}
						</Button>
					{/if}

					<!-- Edit button for local playlists -->
					{#if data.isLocal}
						<Button variant="secondary" onclick={startEdit} title={m.playlist_edit()}>
							<Edit3 size={14} />
							{m.playlist_edit()}
						</Button>

						<Button
							variant="secondary"
							onclick={() => (isDeleting = true)}
							title={m.action_delete_playlist()}
						>
							<Trash2 size={14} class="text-[var(--danger)]" />
						</Button>
					{/if}
				{/snippet}
			</PageHeader>
		{/if}

		{#if syncFeedback}
			<div class="sync-feedback" role="status">
				<span>{syncFeedback}</span>
			</div>
		{/if}

		{#if data.playlist.items.length}
			<section class="tracklist-section" aria-labelledby="playlist-title">
				<TrackTable
					tracks={data.playlist.items}
					contextTracks={data.playlist.items}
					columns={['album', 'date', 'duration']}
				/>
			</section>
		{/if}

		<PageActions tidalUrl={tidalPlaylistUrl} tidalLabel={m.playlist_open_in_tidal()} {retryHref} />
	{:else}
		<StateCard state={data.state} configured={data.configured} {retryHref} />
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<!-- Delete confirmation modal -->
{#if isDeleting && data.playlist}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={() => (isDeleting = false)}></div>
	<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="del-title">
		<header class="modal-header">
			<h2 id="del-title">{m.playlist_delete_confirm({ title: data.playlist.title })}</h2>
			<button
				type="button"
				class="close-btn"
				onclick={() => (isDeleting = false)}
				aria-label={m.action_close()}
			>
				<X size={18} />
			</button>
		</header>
		<div class="modal-body">
			{#if tidalPlaylistId}
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={deleteTidalToo} />
					<span>{m.playlist_delete_tidal_too()}</span>
				</label>
			{/if}
		</div>
		<footer class="modal-footer">
			<Button variant="secondary" onclick={() => (isDeleting = false)} disabled={isDeletePending}>
				{m.playlist_cancel()}
			</Button>
			<Button variant="primary" onclick={confirmDelete} disabled={isDeletePending}>
				{#if isDeletePending}
					<Loader2 size={14} class="animate-spin" />
				{/if}
				{m.action_delete()}
			</Button>
		</footer>
	</div>
{/if}

<style>
	.playlist-page {
		max-width: 72rem;
	}

	.meta-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 600;
		font-family: ui-monospace, monospace;
		text-transform: uppercase;
	}

	.pill-green {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.pill-amber {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.pill-red {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.pill-gray {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
	}

	.edit-panel {
		background: var(--surface-raised);
		border: 1px solid var(--border-color);
		padding: 1.5rem;
		margin-bottom: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.edit-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.edit-field label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.edit-input,
	.edit-textarea {
		background: var(--surface-2);
		border: 1px solid var(--border-color);
		color: var(--text-primary);
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
	}

	.edit-input:focus,
	.edit-textarea:focus {
		border-color: var(--action);
		outline: none;
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.sync-feedback {
		margin-top: 1rem;
		padding: 0.6rem 1rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-color);
		font-size: 0.85rem;
		color: var(--action);
	}

	.tracklist-section {
		margin-top: 2rem;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		z-index: 90;
	}

	.modal-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90vw;
		max-width: 28rem;
		background: var(--surface-1);
		border: 1px solid var(--border-color);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		z-index: 100;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h2 {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
	}

	.modal-body {
		padding: 1.25rem 1.5rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--border-color);
		background: var(--surface-2);
	}

	.attribution {
		margin-top: 3rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}
</style>
