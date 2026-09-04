<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Check, Download, Loader2, Music, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	interface ImportablePlaylist {
		id: string;
		title: string;
		description?: string;
		imageUrl?: string;
		numberOfItems?: number;
		isImported: boolean;
	}

	let playlists = $state<ImportablePlaylist[]>([]);
	const selectedIds = new SvelteSet<string>();
	let isLoading = $state(false);
	let isImporting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	$effect(() => {
		if (customPlaylists.isImportOpen) {
			void loadPlaylists();
		} else {
			// Reset state on close
			playlists = [];
			selectedIds.clear();
			errorMessage = null;
			successMessage = null;
		}
	});

	async function loadPlaylists() {
		isLoading = true;
		errorMessage = null;
		try {
			const res = await fetch('/api/playlists/import');
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || data.error || 'Failed to load TIDAL playlists');
			}
			const data = (await res.json()) as { playlists: ImportablePlaylist[]; error?: string | null };
			if (data.error) {
				throw new Error(data.error);
			}
			playlists = data.playlists || [];
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			isLoading = false;
		}
	}

	function toggleSelect(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
	}

	function toggleSelectAll() {
		const unimported = playlists.filter((p) => !p.isImported);
		if (selectedIds.size === unimported.length) {
			selectedIds.clear();
		} else {
			selectedIds.clear();
			for (const p of unimported) selectedIds.add(p.id);
		}
	}

	async function handleImport() {
		if (selectedIds.size === 0) return;
		isImporting = true;
		errorMessage = null;
		successMessage = null;

		try {
			const res = await fetch('/api/playlists/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tidalPlaylistIds: Array.from(selectedIds) })
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || err.error || 'Import failed');
			}

			const data = (await res.json()) as {
				totalImported: number;
				totalErrors: number;
				totalTracksSkipped: number;
				totalTracksReplaced: number;
				streamValidation: 'verified' | 'unavailable';
			};
			const importSummary = `${m.playlist_import_done()} (${data.totalImported})`;
			if (data.streamValidation === 'unavailable') {
				successMessage = `${importSummary} ${m.playlist_import_streams_unavailable()}`;
			} else if (data.totalTracksSkipped || data.totalTracksReplaced) {
				successMessage = `${importSummary} ${m.playlist_import_streams_checked()} ${m.playlist_import_streams_adjusted({ replaced: data.totalTracksReplaced, skipped: data.totalTracksSkipped })}`;
			} else {
				successMessage = `${importSummary} ${m.playlist_import_streams_checked()}`;
			}

			// Refresh client-side custom playlist store
			await customPlaylists.syncWithServer();

			// Reload the list to update `isImported` badges
			await loadPlaylists();
			selectedIds.clear();

			setTimeout(() => {
				customPlaylists.closeImport();
			}, 1200);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Import failed';
		} finally {
			isImporting = false;
		}
	}
</script>

{#if customPlaylists.isImportOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={() => customPlaylists.closeImport()}></div>

	<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
		<header class="modal-header">
			<div class="title-wrap">
				<Download size={20} class="text-[var(--action)]" />
				<h2 id="import-modal-title">{m.playlist_import()}</h2>
			</div>
			<button
				type="button"
				class="close-btn"
				onclick={() => customPlaylists.closeImport()}
				aria-label={m.action_close()}
			>
				<X size={18} />
			</button>
		</header>

		<div class="modal-body">
			{#if errorMessage}
				<div class="notice-box notice-error" role="alert">
					<p>{errorMessage}</p>
				</div>
			{/if}

			{#if successMessage}
				<div class="notice-box notice-success" role="status">
					<Check size={16} />
					<p>{successMessage}</p>
				</div>
			{/if}

			{#if isLoading}
				<div class="loading-wrap">
					<Loader2 size={24} class="animate-spin text-[var(--action)]" />
					<span>Loading TIDAL playlists…</span>
				</div>
			{:else if playlists.length === 0}
				<div class="empty-wrap">
					<p>{m.playlist_no_playlists()}</p>
				</div>
			{:else}
				<div class="list-actions">
					<span class="count-label"
						>{selectedIds.size} of {playlists.filter((p) => !p.isImported).length} selected</span
					>
					<button type="button" class="select-all-btn" onclick={toggleSelectAll}>
						{selectedIds.size === playlists.filter((p) => !p.isImported).length
							? 'Deselect all'
							: 'Select all unimported'}
					</button>
				</div>

				<div class="playlist-list" role="list">
					{#each playlists as pl (pl.id)}
						<label
							class="playlist-item"
							class:is-imported={pl.isImported}
							class:is-selected={selectedIds.has(pl.id)}
						>
							<input
								type="checkbox"
								checked={selectedIds.has(pl.id)}
								disabled={pl.isImported || isImporting}
								onchange={() => toggleSelect(pl.id)}
								class="checkbox-input"
							/>

							{#if pl.imageUrl}
								<img class="item-thumb" src={pl.imageUrl} alt="" aria-hidden="true" />
							{:else}
								<div class="item-thumb thumb-placeholder" aria-hidden="true">
									<Music size={16} />
								</div>
							{/if}

							<div class="item-info">
								<strong class="item-title">{pl.title}</strong>
								<span class="item-meta">
									{#if pl.numberOfItems != null}
										{pl.numberOfItems} {m.playlist_track_count()}
									{/if}
								</span>
							</div>

							{#if pl.isImported}
								<span class="imported-badge">
									<Check size={12} />
									{m.playlist_synced()}
								</span>
							{/if}
						</label>
					{/each}
				</div>
			{/if}
		</div>

		<footer class="modal-footer">
			<Button
				variant="secondary"
				onclick={() => customPlaylists.closeImport()}
				disabled={isImporting}
			>
				{m.playlist_cancel()}
			</Button>

			<Button
				variant="primary"
				disabled={selectedIds.size === 0 || isImporting || isLoading}
				onclick={handleImport}
			>
				{#if isImporting}
					<Loader2 size={14} class="animate-spin" />
					{m.playlist_import_importing()}
				{:else}
					<Download size={14} />
					{m.playlist_import()} ({selectedIds.size})
				{/if}
			</Button>
		</footer>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		z-index: 90;
		animation: fadeIn 0.15s ease-out;
	}

	.modal-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90vw;
		max-width: 34rem;
		max-height: 85vh;
		background: var(--surface-1);
		border: 1px solid var(--border-color);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		z-index: 100;
		display: flex;
		flex-direction: column;
		animation: slideIn 0.2s ease-out;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.title-wrap {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.title-wrap h2 {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin: 0;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s ease;
	}

	.close-btn:hover {
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.25rem 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		flex: 1;
	}

	.notice-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		border: 1px solid transparent;
	}

	.notice-error {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
		color: #ef4444;
	}

	.notice-success {
		background: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.3);
		color: #22c55e;
	}

	.loading-wrap,
	.empty-wrap {
		padding: 3rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.list-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--text-muted);
		padding-bottom: 0.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	.select-all-btn {
		background: transparent;
		border: none;
		color: var(--action);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
	}

	.select-all-btn:hover {
		text-decoration: underline;
	}

	.playlist-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 20rem;
		overflow-y: auto;
	}

	.playlist-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border-color);
		background: var(--surface-2);
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.playlist-item:hover:not(.is-imported) {
		background: var(--surface-3, rgba(255, 255, 255, 0.05));
		border-color: var(--action);
	}

	.playlist-item.is-selected {
		border-color: var(--action);
		background: rgba(59, 130, 246, 0.08);
	}

	.playlist-item.is-imported {
		opacity: 0.6;
		cursor: default;
	}

	.checkbox-input {
		accent-color: var(--action);
		cursor: pointer;
	}

	.item-thumb {
		width: 2.25rem;
		height: 2.25rem;
		object-fit: cover;
		flex-shrink: 0;
	}

	.thumb-placeholder {
		background: var(--surface-3, rgba(255, 255, 255, 0.05));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.item-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.item-title {
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
	}

	.imported-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--action);
		font-family: ui-monospace, monospace;
		text-transform: uppercase;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--border-color);
		background: var(--surface-2);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translate(-50%, -48%) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
</style>
