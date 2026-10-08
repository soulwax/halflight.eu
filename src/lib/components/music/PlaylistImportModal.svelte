<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { TrackSummary } from '#lib/tidal/models';
	import SearchField from '#lib/components/ui/SearchField.svelte';
	import { Check, Download, Loader2, Music } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import {
		fetchWithinImportBudget,
		readImportResult,
		readImportResponse,
		type ImportResult
	} from '#lib/playlists/import-result';
	import Button from '#lib/components/ui/Button.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	interface ImportablePlaylist {
		id: string;
		title: string;
		description?: string;
		imageUrl?: string;
		numberOfItems?: number;
		isImported: boolean;
	}
	let { onImported }: { onImported?: () => void | Promise<void> } = $props();
	let playlists = $state<ImportablePlaylist[]>([]);
	let loadError = $state(false);
	let loading = $state(false);
	let importError = $state<string | null>(null);
	let loadVersion = 0;
	let importVersion = 0;
	let loadController: AbortController | null = null;
	let importController: AbortController | null = null;
	const selectedIds = new SvelteSet<string>();
	let isImporting = $state(false);
	let notification = $state<string | null>(null);
	let reviewQueue = $state<{ playlistId: string; source: TrackSummary }[]>([]);
	let review = $state<{ playlistId: string; source: TrackSummary } | null>(null);
	let reviewCandidates = $state<TrackSummary[]>([]);
	let reviewQuery = $state('');
	let reviewVersion = '';
	let reviewBusy = $state(false);
	let reviewError = $state(false);
	let reviewGeneration = 0;
	let reviewController: AbortController | null = null;
	async function nextReview() {
		review = reviewQueue[0] ?? null;
		reviewQueue = reviewQueue.slice(1);
		if (!review) return;
		reviewQuery = `${review.source.title} ${review.source.artists[0]?.name ?? ''}`.trim();
		customPlaylists.closeImport();
		await searchReview(false);
	}
	async function searchReview(manual = true) {
		if (!review) return;
		const current = review;
		const generation = ++reviewGeneration;
		reviewController?.abort();
		reviewController = new AbortController();
		reviewBusy = true;
		reviewError = false;
		reviewCandidates = [];
		try {
			const params = new URLSearchParams({
				sourceId: current.source.id,
				...(manual ? { q: reviewQuery } : {})
			});
			const response = await fetch(
				`/api/playlists/${encodeURIComponent(current.playlistId)}/repair-import?${params}`,
				{ signal: AbortSignal.any([reviewController.signal, AbortSignal.timeout(60_000)]) }
			);
			if (!response.ok) throw new Error('Repair search unavailable');
			const body = await response.json();
			if (generation !== reviewGeneration || review !== current) return;
			reviewCandidates = body.candidates;
			reviewVersion = body.version;
		} catch {
			if (generation === reviewGeneration) reviewError = true;
		} finally {
			if (generation === reviewGeneration) reviewBusy = false;
		}
	}
	async function acceptReview(candidate: TrackSummary) {
		if (!review || reviewBusy) return;
		reviewBusy = true;
		reviewError = false;
		const current = review;
		try {
			const response = await fetch(
				`/api/playlists/${encodeURIComponent(current.playlistId)}/repair-import`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						sourceId: current.source.id,
						candidateId: candidate.id,
						version: reviewVersion
					}),
					signal: AbortSignal.timeout(90_000)
				}
			);
			if (!response.ok) throw new Error('Repair failed');
			const result = await response.json().catch(() => null);
			const restored =
				Number.isSafeInteger(result?.restoredCount) && result.restoredCount > 0
					? result.restoredCount
					: 1;
			outcomes = outcomes.map((outcome) =>
				outcome.playlistId === current.playlistId
					? {
							...outcome,
							tracksSkipped: Math.max(0, outcome.tracksSkipped - restored),
							tracksReplaced: outcome.tracksReplaced + restored,
							unmatchedTracks: outcome.unmatchedTracks?.filter(
								(track) => track.id !== current.source.id
							)
						}
					: outcome
			);
			await Promise.allSettled([
				customPlaylists.syncWithServer(),
				Promise.resolve().then(() => onImported?.())
			]);
			if (review !== current) return;
			reviewBusy = false;
			await nextReview();
		} catch {
			if (review === current) {
				reviewBusy = false;
				reviewError = true;
			}
		}
	}
	function skipReview() {
		reviewGeneration++;
		reviewController?.abort();
		reviewBusy = false;
		void nextReview();
	}

	let stopRequested = $state(false);
	let outcomes = $state<ImportResult[]>([]);
	let currentTitle = $state('');
	let completed = $state(0);
	let batchTotal = $state(0);
	let waitSeconds = $state(0);
	const successful = $derived(
		outcomes.filter((result) => result.status === 'created' || result.status === 'synced')
	);
	const successfulIds = $derived(new Set(successful.map((result) => result.tidalPlaylistId)));
	const successMessage = $derived(
		successful.length
			? `${m.playlist_import_done()} (${successful.length}) ${m.playlist_import_source_preserved()} ${m.playlist_import_streams_adjusted({ replaced: successful.reduce((sum, result) => sum + result.tracksReplaced, 0), skipped: successful.reduce((sum, result) => sum + result.tracksSkipped, 0) })}`
			: null
	);

	$effect(() => {
		const open = customPlaylists.isImportOpen;
		untrack(() => {
			if (open) {
				notification = null;
				if (!isImporting) void loadPlaylists();
			} else if (!isImporting && !notification) {
				loadVersion++;
				importVersion++;
				loadController?.abort();
				playlists = [];
				importError = null;
				selectedIds.clear();
				outcomes = [];
			}
		});
	});

	$effect(() => {
		const requests = customPlaylists.importReviewRequests;
		if (!requests.length) return;
		untrack(() => {
			customPlaylists.importReviewRequests = [];
			reviewQueue = [...reviewQueue, ...requests];
			if (!isImporting && !review) void nextReview();
		});
	});

	onDestroy(() => {
		loadVersion += 1;
		importVersion += 1;
		loadController?.abort();
		importController?.abort();
		reviewController?.abort();
		reviewGeneration++;
		customPlaylists.importReviewRequests = [];
	});
	async function loadPlaylists() {
		const version = ++loadVersion;
		loadController?.abort();
		loadController = new AbortController();
		loading = true;
		loadError = false;
		try {
			const signal = loadController.signal;
			const res = await fetchWithinImportBudget(
				() =>
					fetch('/api/playlists/import', {
						signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])
					}),
				signal
			);
			if (!res.ok) throw new Error('Playlist list unavailable');
			const data = (await res.json()) as { playlists: ImportablePlaylist[]; error?: string | null };
			if (version !== loadVersion) return;
			if (data.error || !Array.isArray(data.playlists)) throw new Error('Invalid playlist list');
			playlists = data.playlists;
			for (const playlist of playlists) if (playlist.isImported) selectedIds.delete(playlist.id);
		} catch {
			if (version === loadVersion) loadError = true;
		} finally {
			if (version === loadVersion) loading = false;
		}
	}
	function toggleSelect(id: string) {
		if (isImporting) return;
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
	}
	function toggleSelectAll() {
		if (isImporting) return;
		const unimported = playlists.filter(
			(playlist) => !playlist.isImported && !successfulIds.has(playlist.id)
		);
		if (selectedIds.size === unimported.length) selectedIds.clear();
		else {
			selectedIds.clear();
			for (const playlist of unimported) selectedIds.add(playlist.id);
		}
	}
	function savedDespiteLostResponse(result: ImportResult): boolean {
		return (
			result.status === 'error' &&
			playlists.some((playlist) => playlist.id === result.tidalPlaylistId && playlist.isImported)
		);
	}
	function outcomeMessage(result: ImportResult): string {
		if (savedDespiteLostResponse(result)) return m.playlist_import_saved_found();
		if (result.errorCode === 'playback_not_linked') return m.playlist_import_streams_unavailable();
		if (result.errorCode === 'reconnect_required') return m.playlist_import_reconnect();
		if (result.errorCode === 'rate_limited') return m.playlist_import_rate_limited();
		if (result.status === 'conflict') return m.playlist_import_changes_kept();
		if (result.errorCode === 'no_playable_tracks') return m.playlist_import_no_playable();
		if (result.errorCode === 'source_changed') return m.playlist_import_source_changed();
		if (result.status === 'error') return m.playlist_import_retry_item();
		return `${m.playlist_import_streams_adjusted({ replaced: result.tracksReplaced, skipped: result.tracksSkipped })}${result.tracksBestFit ? ` ${m.playlist_import_best_fits({ count: result.tracksBestFit })}` : ''}`;
	}
	async function handleImport() {
		if (!selectedIds.size || isImporting) return;
		const ids = [...selectedIds];
		const version = ++importVersion;
		const controller = new AbortController();
		importController = controller;
		isImporting = true;
		notification = null;
		stopRequested = false;
		importError = null;
		completed = 0;
		batchTotal = ids.length;
		let changed = false;
		try {
			// One source per request gives genuine progress and keeps failures isolated.
			for (const id of ids) {
				if (version !== importVersion || controller.signal.aborted || stopRequested) break;
				currentTitle = playlists.find((playlist) => playlist.id === id)?.title ?? '';
				let result: ImportResult;
				try {
					const response = await fetchWithinImportBudget(
						() =>
							fetch('/api/playlists/import', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ tidalPlaylistIds: [id] }),
								signal: controller.signal
							}),
						controller.signal,
						(seconds) => {
							if (version === importVersion) waitSeconds = seconds;
						}
					);
					if (!response.ok) throw new Error('Import unavailable');
					result = readImportResult(await readImportResponse(response, controller.signal), id);
				} catch {
					result = {
						tidalPlaylistId: id,
						status: 'error',
						tracksSkipped: 0,
						tracksReplaced: 0,
						tracksBestFit: 0
					};
				}
				if (version !== importVersion) return;
				outcomes = [...outcomes.filter((outcome) => outcome.tidalPlaylistId !== id), result];
				completed++;
				if (result.status === 'created' || result.status === 'synced') {
					selectedIds.delete(id);
					changed = true;
					if (result.playlistId)
						reviewQueue = [
							...reviewQueue,
							...(result.unmatchedTracks ?? []).map((source) => ({
								playlistId: result.playlistId!,
								source
							}))
						];
				}
			}
			if (version !== importVersion) return;
			if (changed) {
				// Refresh failures cannot turn a committed import into a reported failure.
				await Promise.allSettled([
					customPlaylists.syncWithServer(),
					Promise.resolve().then(() => onImported?.())
				]);
			}
			if (version !== importVersion) return;
			await loadPlaylists();
			if (version !== importVersion) return;
			const failures = outcomes.filter(
				(result) =>
					(result.status === 'error' || result.status === 'conflict') &&
					!savedDespiteLostResponse(result)
			);
			importError = failures.length
				? m.playlist_import_some_failed({ count: failures.length })
				: null;
			// Keep failed selections for a one-click retry; successful ones stay deselected.
		} finally {
			if (version === importVersion) {
				isImporting = false;
				currentTitle = '';
				if (reviewQueue.length && !review) void nextReview();
				if (!customPlaylists.isImportOpen) notification = importError ?? m.playlist_import_done();
			}
		}
	}
</script>

<Dialog
	open={customPlaylists.isImportOpen}
	title={m.playlist_import()}
	description={m.playlist_import_explanation()}
	closeDisabled={false}
	onOpenChange={(open) => {
		if (!open) customPlaylists.closeImport();
	}}
>
	<div class="modal-body">
		{#if successMessage}
			<Notice tone="success">{successMessage}</Notice>
		{/if}

		{#if importError}<Notice tone="danger">{importError}</Notice>{/if}
		{#if stopRequested && !isImporting}<Notice>{m.playlist_import_stopped()}</Notice>{/if}
		{#if isImporting}
			<div class="import-progress" role="status" aria-live="polite">
				<p>{m.playlist_import_progress({ completed, total: batchTotal })}</p>
				<p>
					{waitSeconds
						? m.playlist_import_waiting({ seconds: waitSeconds })
						: m.playlist_import_verifying({ title: currentTitle })}
				</p>
				<progress
					value={completed}
					max={batchTotal}
					aria-label={m.playlist_import_progress({ completed, total: batchTotal })}
				></progress>
			</div>
		{/if}
		{#if loading}<p role="status">{m.playlist_import_loading()}</p>
		{:else if loadError}<Notice tone="danger">{m.playlist_import_load_failed()}</Notice><Button
				onclick={loadPlaylists}>{m.track_retry()}</Button
			>
		{:else if playlists.length === 0}
			<div class="empty-wrap">
				<p>{m.playlist_no_playlists()}</p>
			</div>
		{:else}
			<div class="list-actions">
				<span class="count-label"
					>{m.playlist_import_selected({
						count: selectedIds.size,
						total: playlists.filter((p) => !p.isImported && !successfulIds.has(p.id)).length
					})}</span
				>
				<button
					type="button"
					class="select-all-btn"
					onclick={toggleSelectAll}
					disabled={isImporting}
				>
					{selectedIds.size ===
					playlists.filter((p) => !p.isImported && !successfulIds.has(p.id)).length
						? m.playlist_import_deselect_all()
						: m.playlist_import_select_all()}
				</button>
			</div>

			<div class="playlist-list" role="list">
				{#each playlists as pl (pl.id)}
					<label
						class="playlist-item"
						class:is-imported={pl.isImported || successfulIds.has(pl.id)}
						class:is-selected={selectedIds.has(pl.id)}
					>
						<input
							type="checkbox"
							checked={selectedIds.has(pl.id)}
							disabled={pl.isImported || successfulIds.has(pl.id) || isImporting}
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
							{#each outcomes.filter((result) => result.tidalPlaylistId === pl.id) as outcome (outcome.tidalPlaylistId)}
								<span
									class="item-outcome"
									class:failed={(outcome.status === 'error' || outcome.status === 'conflict') &&
										!savedDespiteLostResponse(outcome)}>{outcomeMessage(outcome)}</span
								>
							{/each}
						</div>

						{#if pl.isImported || successfulIds.has(pl.id)}
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
		{#if isImporting}<Button variant="secondary" onclick={() => customPlaylists.closeImport()}
				>{m.playlist_import_minimize()}</Button
			>{/if}
		<Button
			variant="secondary"
			onclick={() => {
				if (isImporting) stopRequested = true;
				else customPlaylists.closeImport();
			}}
			disabled={isImporting && stopRequested}
		>
			{isImporting
				? stopRequested
					? m.playlist_import_stopping()
					: m.playlist_import_stop()
				: outcomes.length
					? m.action_close()
					: m.playlist_cancel()}
		</Button>

		<Button
			variant="primary"
			disabled={selectedIds.size === 0 || isImporting}
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
</Dialog>

{#if !customPlaylists.isImportOpen && (isImporting || notification)}
	<aside class="import-background" aria-label={m.playlist_import()}>
		<button type="button" class="background-open" onclick={() => customPlaylists.openImport()}>
			{#if isImporting}<Loader2 size={16} class="animate-spin" /><span
					>{m.playlist_import_progress({ completed, total: batchTotal })}</span
				>{:else}<Check size={16} /><span role="status">{notification}</span>{/if}
		</button>
		{#if !isImporting}<button
				type="button"
				class="background-dismiss"
				aria-label={m.action_close()}
				onclick={() => {
					notification = null;
					outcomes = [];
					playlists = [];
				}}>{m.action_close()}</button
			>{/if}
	</aside>
{/if}

<Dialog
	open={Boolean(review)}
	title={m.playlist_import_match_title()}
	description={m.playlist_import_match_description()}
	closeDisabled={reviewBusy}
	onOpenChange={(open) => {
		if (!open && !reviewBusy) skipReview();
	}}
>
	{#if review}
		<section class="match-body">
			<p>
				<strong>{review.source.title}</strong> · {review.source.artists
					.map((artist) => artist.name)
					.join(', ')}
			</p>
			<SearchField
				id="import-match-search"
				label={m.search_button()}
				placeholder={m.search_button()}
				value={reviewQuery}
				oninput={(event) => {
					reviewQuery = (event.currentTarget as HTMLInputElement).value;
				}}
				onclear={() => {
					reviewQuery = '';
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' && !event.isComposing) void searchReview();
				}}
			/>
			<Button disabled={reviewBusy || !reviewQuery.trim()} onclick={() => void searchReview()}
				>{m.search_button()}</Button
			>
			{#if reviewError}<Notice tone="danger">{m.playlist_import_match_failed()}</Notice>{/if}
			{#if reviewBusy}<p role="status">
					{m.playlist_import_importing()}
				</p>{:else if !reviewCandidates.length}<p>{m.playlist_import_match_empty()}</p>{/if}
			{#each reviewCandidates as candidate (candidate.id)}
				<button
					class="match-candidate"
					type="button"
					disabled={reviewBusy}
					onclick={() => void acceptReview(candidate)}
					><strong>{candidate.title}</strong><span
						>{candidate.artists.map((artist) => artist.name).join(', ')}</span
					></button
				>
			{/each}
			<Button variant="secondary" disabled={reviewBusy} onclick={skipReview}
				>{m.playlist_import_match_skip()}</Button
			>
		</section>
	{/if}
</Dialog>

<style>
	.match-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.match-candidate {
		display: flex;
		flex-direction: column;
		text-align: left;
		padding: 0.8rem;
		border: 1px solid var(--border-subtle);
		background: var(--paper);
		color: var(--text-primary);
		cursor: pointer;
		min-height: 48px;
	}
	.import-background {
		position: fixed;
		z-index: 140;
		right: 1rem;
		bottom: calc(env(safe-area-inset-bottom) + 9.5rem);
		display: flex;
		max-width: calc(100vw - 2rem);
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg, 12px);
		box-shadow: var(--shadow-float);
	}
	.background-open,
	.background-dismiss {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		border: 0;
		color: var(--text-primary);
		background: transparent;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
	}
	.modal-body {
		padding: 1.25rem 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		flex: 1;
	}

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
		border-bottom: 1px solid var(--border-subtle);
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
		border: 1px solid var(--border-subtle);
		background: var(--paper);
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.playlist-item:hover:not(.is-imported) {
		background: var(--paper);
		border-color: var(--action);
	}

	.playlist-item.is-selected {
		border-color: var(--action);
		background: color-mix(in srgb, var(--action) 8%, transparent);
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
		background: var(--paper);
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
		border-top: 1px solid var(--border-subtle);
		background: var(--paper);
	}

	.item-outcome {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: normal;
	}
	.item-outcome.failed {
		color: var(--danger, #e88b8b);
	}
	.import-progress p {
		margin: 0.25rem 0;
	}
	progress {
		width: 100%;
		accent-color: var(--action);
	}
	.modal-footer {
		flex-wrap: wrap;
	}
	.list-actions {
		gap: 0.5rem;
	}
	@media (max-width: 480px) {
		.modal-body {
			padding: 1rem;
		}
		.modal-footer {
			padding: 1rem;
		}
		.item-thumb {
			width: 2rem;
			height: 2rem;
		}
	}
</style>
