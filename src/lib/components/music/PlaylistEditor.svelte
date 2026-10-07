<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { player } from '#lib/player/player.svelte';
	import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, Undo2 } from '@lucide/svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SearchField from '#lib/components/ui/SearchField.svelte';
	import PlaylistCover from './PlaylistCover.svelte';
	import { LiveSearchScheduler } from '#lib/search/live-search';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { onDestroy } from 'svelte';
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { ensureQueueDndInitialized } from '#lib/player/queue-dnd';
	import type { TrackSummary, SearchResultGroups } from '#lib/tidal/models';
	let {
		id,
		title,
		description = '',
		tracks,
		mobile = false,
		version
	}: {
		id: string;
		title: string;
		description?: string;
		tracks: TrackSummary[];
		version: string;
		mobile?: boolean;
	} = $props();
	type Row = { key: number; entryId: string; track: TrackSummary; sourceIndex?: number };
	let open = $state(false);
	let editingId = $state('');
	let editingVersion = '';
	$effect(() => {
		if (open && editingId !== id) {
			open = false;
			cancelSearch();
		}
	});
	let deleteOpen = $state(false);
	let copying = $state(false);
	let deleting = $state(false);
	let toolbarError = $state<string | null>(null);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let rows = $state<Row[]>([]);
	let undo = $state<Row[][]>([]);
	let sequence = 0;
	let dragSnapshot = $state<Row[] | null>(null);
	let query = $state('');
	let results = $state<TrackSummary[]>([]);
	let searching = $state(false);
	let saving = $state(false);
	let failure = $state<string | null>(null);
	let controller: AbortController | null = null;
	let requestVersion = 0;
	const scheduler = new LiveSearchScheduler();
	onDestroy(() => {
		scheduler.cancel();
		controller?.abort();
	});
	function start(): void {
		cancelSearch();
		editingId = id;
		editingVersion = version;
		dragSnapshot = null;
		draftTitle = title;
		draftDescription = description;
		ensureQueueDndInitialized();
		rows = tracks.map((track, sourceIndex) => {
			const key = ++sequence;
			return { key, entryId: `playlist-editor-${id}-${key}`, track, sourceIndex };
		});
		undo = [];
		query = '';
		results = [];
		failure = null;
		open = true;
	}
	function checkpoint(): void {
		undo = [...undo.slice(-29), [...rows]];
	}
	function move(index: number, direction: number): void {
		const next = index + direction;
		if (next < 0 || next >= rows.length) return;
		checkpoint();
		const reordered = [...rows];
		[reordered[index], reordered[next]] = [reordered[next], reordered[index]];
		rows = reordered;
	}
	function remove(index: number): void {
		checkpoint();
		rows = rows.filter((_, at) => at !== index);
	}
	function add(track: TrackSummary): void {
		checkpoint();
		const key = ++sequence;
		rows = [...rows, { key, entryId: `playlist-editor-${id}-${key}`, track }];
	}
	function consider(event: CustomEvent<DndEvent<Row>>): void {
		dragSnapshot ??= [...rows];
		rows = event.detail.items;
	}
	function finalize(event: CustomEvent<DndEvent<Row>>): void {
		if (
			dragSnapshot &&
			event.detail.items.map((row) => row.entryId).join(',') !==
				dragSnapshot.map((row) => row.entryId).join(',')
		)
			undo = [...undo.slice(-29), dragSnapshot];
		rows = event.detail.items;
		dragSnapshot = null;
	}
	function cancelSearch(): void {
		scheduler.cancel();
		controller?.abort();
		requestVersion++;
		searching = false;
	}
	function input(event: Event): void {
		failure = null;
		query = (event.currentTarget as HTMLInputElement).value;
		scheduler.cancel(true);
		controller?.abort();
		const revision = ++requestVersion;
		results = [];
		searching = query.trim().length >= 2;
		if (searching) scheduler.schedule(() => void search(query.trim(), revision));
		else scheduler.cancel();
	}
	async function search(value: string, revision = ++requestVersion): Promise<void> {
		failure = null;
		scheduler.cancel();
		controller?.abort();
		controller = new AbortController();
		searching = true;
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
				signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)])
			});
			if (!response.ok) throw new Error('Search failed');
			const body = (await response.json()) as { results: SearchResultGroups };
			if (revision === requestVersion && open) results = body.results.tracks;
		} catch {
			if (revision === requestVersion) failure = m.now_search_unavailable();
		} finally {
			if (revision === requestVersion) searching = false;
		}
	}
	async function duplicate(): Promise<void> {
		if (copying) return;
		copying = true;
		toolbarError = null;
		try {
			const response = await fetch(`/api/playlists/${encodeURIComponent(id)}/duplicate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: m.playlist_editor_copy_title({ title }).slice(0, 200),
					version
				})
			});
			if (!response.ok) throw new Error('Copy failed');
			const body = (await response.json()) as { id: string };
			await customPlaylists.syncWithServer();
			await goto(
				mobile
					? resolve('/(mobile)/playlists/[id]', { id: body.id })
					: resolve('/app/playlists/[id]', { id: body.id })
			);
		} catch {
			toolbarError = m.playlist_editor_error();
		} finally {
			copying = false;
		}
	}
	async function deletePlaylist(): Promise<void> {
		if (deleting) return;
		deleting = true;
		toolbarError = null;
		try {
			if (!(await customPlaylists.deletePlaylist(id))) throw new Error('Delete failed');
			deleteOpen = false;
			await goto(mobile ? resolve('/(mobile)/library') : resolve('/app/library'));
		} catch {
			toolbarError = m.playlist_editor_error();
		} finally {
			deleting = false;
		}
	}
	async function save(): Promise<void> {
		if (saving || !draftTitle.trim()) return;
		saving = true;
		failure = null;
		try {
			const response = await fetch(`/api/playlists/${encodeURIComponent(editingId)}/edit`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: draftTitle,
					description: draftDescription,
					items: rows.map(({ sourceIndex, track }) =>
						sourceIndex === undefined ? { track } : { sourceIndex }
					),
					version: editingVersion
				})
			});
			if (!response.ok) {
				failure =
					response.status === 409 ? m.playlist_editor_conflict() : m.playlist_editor_error();
				return;
			}
			cancelSearch();
			open = false;
			await customPlaylists.syncWithServer();
			await invalidateAll();
		} catch {
			failure = m.playlist_editor_error();
		} finally {
			saving = false;
		}
	}
</script>

<div class="toolbar">
	<Button onclick={start}>{m.playlist_edit()}</Button><Button disabled={copying} onclick={duplicate}
		>{m.playlist_editor_duplicate()}</Button
	>{#if mobile}<Button onclick={() => (deleteOpen = true)}>{m.action_delete_playlist()}</Button
		>{/if}
</div>
{#if toolbarError && !deleteOpen}<p class="toolbar-error" role="alert">{toolbarError}</p>{/if}
<Dialog
	bind:open={deleteOpen}
	title={m.action_delete_playlist()}
	description={m.playlist_editor_delete_description({ title })}
	><div class="editor">
		{#if toolbarError}<p role="alert">{toolbarError}</p>{/if}
		<div class="footer">
			<Button disabled={deleting} onclick={() => (deleteOpen = false)}>{m.playlist_cancel()}</Button
			><Button disabled={deleting} variant="primary" onclick={deletePlaylist}
				>{m.action_delete()}</Button
			>
		</div>
	</div></Dialog
>
<Dialog
	bind:open
	title={m.playlist_edit()}
	description={m.playlist_editor_local()}
	onOpenChange={(value) => {
		if (!value) cancelSearch();
	}}
>
	<div class="editor" aria-busy={saving}>
		<div class="preview"><PlaylistCover tracks={rows.map(({ track }) => track)} /></div>
		<label
			>{m.track_col_title()}<input
				maxlength="200"
				bind:value={draftTitle}
				disabled={saving}
			/></label
		>
		<label
			>{m.playlist_field_description()}<textarea
				maxlength="4000"
				rows="3"
				bind:value={draftDescription}
				disabled={saving}></textarea></label
		>
		<div class="section-heading">
			<h3>{m.now_library_count({ count: rows.length })}</h3>
			<button
				type="button"
				disabled={saving || dragSnapshot !== null || !undo.length}
				onclick={() => {
					rows = undo.at(-1)!;
					undo = undo.slice(0, -1);
				}}><Undo2 size={18} aria-hidden="true" />{m.playlist_editor_undo()}</button
			>
		</div>
		<ol
			use:dragHandleZone={{
				items: rows,
				type: `playlist-editor-${id}`,
				dragDisabled: saving,
				delayTouchStart: 150
			}}
			onconsider={consider}
			onfinalize={finalize}
		>
			{#each rows as row, index (row.entryId)}<li>
					<div class="identity">
						<strong>{row.track.title}</strong><small
							>{row.track.artists.map((artist) => artist.name).join(', ')}</small
						>
					</div>
					<div class="row-actions">
						<button
							type="button"
							use:dragHandle
							disabled={saving}
							class="drag-handle"
							aria-label={m.playlist_editor_drag({ title: row.track.title })}
							><GripVertical size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							disabled={saving || dragSnapshot !== null || index === 0}
							aria-label={m.playlist_editor_up({ title: row.track.title })}
							onclick={() => move(index, -1)}><ArrowUp size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							disabled={saving || dragSnapshot !== null || index === rows.length - 1}
							aria-label={m.playlist_editor_down({ title: row.track.title })}
							onclick={() => move(index, 1)}><ArrowDown size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							disabled={saving}
							aria-label={m.playlist_editor_remove({ title: row.track.title })}
							onclick={() => remove(index)}><Trash2 size={18} aria-hidden="true" /></button
						>
					</div>
				</li>{/each}
		</ol>
		{#if player.currentTrack && player.resumeStatus === 'ready'}<Button
				disabled={saving}
				onclick={() => player.currentTrack && add(player.currentTrack)}
				>{m.playlist_editor_add_current()}</Button
			>{/if}
		<form
			role="search"
			onsubmit={(event) => {
				event.preventDefault();
				if (query.trim().length >= 2) void search(query.trim());
			}}
		>
			<SearchField
				id={`playlist-add-${id}`}
				label={m.playlist_editor_add()}
				placeholder={m.now_search_placeholder()}
				value={query}
				{searching}
				oninput={input}
				onclear={() => {
					cancelSearch();
					query = '';
					results = [];
				}}
				oncompositionstart={cancelSearch}
			/>
		</form>
		{#if searching}<p role="status">{m.search_live_searching()}</p>{/if}
		{#if results.length}<ul class="search-results">
				{#each results as track (track.id)}<li>
						<div class="identity">
							<strong>{track.title}</strong><small
								>{track.artists.map((artist) => artist.name).join(', ')}</small
							>
						</div>
						<button
							type="button"
							disabled={saving}
							aria-label={m.playlist_editor_add_song({ title: track.title })}
							onclick={() => add(track)}><Plus size={18} aria-hidden="true" /></button
						>
					</li>{/each}
			</ul>{/if}
		{#if failure}<p role="alert">{failure}</p>{/if}
		<div class="footer">
			<Button
				disabled={saving}
				onclick={() => {
					cancelSearch();
					open = false;
				}}>{m.playlist_cancel()}</Button
			><Button
				variant="primary"
				disabled={saving || dragSnapshot !== null || !draftTitle.trim()}
				onclick={save}>{saving ? m.playlist_editor_saving() : m.playlist_save()}</Button
			>
		</div>
	</div>
</Dialog>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.toolbar-error {
		color: var(--danger);
	}
	.footer :global(.btn-base) {
		max-width: 100%;
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.editor {
		padding: 1.25rem;
		display: grid;
		gap: 1rem;
	}
	.preview {
		width: 7rem;
		height: 7rem;
		border-radius: var(--radius-md);
	}
	label {
		display: grid;
		gap: 0.4rem;
	}
	input,
	textarea {
		width: 100%;
		min-width: 0;
		min-height: 3rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 0.6rem;
		font: inherit;
		font-size: 1rem;
		color: var(--text-primary);
		background: var(--surface-raised);
	}
	.section-heading,
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	h3,
	p {
		margin: 0;
	}
	ol,
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding-block: 0.5rem;
		border-top: 1px solid var(--border-subtle);
	}
	.identity {
		display: grid;
		min-width: 0;
		flex: 1 1 10rem;
		gap: 0.2rem;
		overflow-wrap: anywhere;
	}
	small {
		color: var(--text-muted);
	}
	.drag-handle {
		cursor: grab;
	}
	.row-actions {
		display: flex;
		margin-left: auto;
		flex-wrap: wrap;
		max-width: 100%;
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		min-height: 3rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		gap: 0.4rem;
		font: inherit;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	button:focus-visible,
	input:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	ol {
		max-height: 40dvh;
		overflow: auto;
	}
	[role='alert'] {
		color: var(--danger);
	}
</style>
