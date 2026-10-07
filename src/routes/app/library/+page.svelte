<script lang="ts">
	import { ArrowDownToLine, Download, Play, RefreshCw, Sparkles, Trash2 } from '@lucide/svelte';

	import PlaylistCover from '#lib/components/music/PlaylistCover.svelte';
	import MediaCard from '#lib/components/music/MediaCard.svelte';
	import PrivateMusicShelf from '#lib/components/music/PrivateMusicShelf.svelte';
	import PlaylistImportModal from '#lib/components/music/PlaylistImportModal.svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import type { TrackSummary } from '#lib/tidal/models';
	import Notice from '#lib/components/ui/Notice.svelte';
	import { resolve } from '$app/paths';
	import SearchField from '#lib/components/ui/SearchField.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let view = $state<'saved' | 'tidal' | 'private'>('saved');
	let query = $state('');
	let sort = $state<'recent' | 'name'>('recent');
	let loadedServerPlaylists = $state(false);
	let previousSnapshot: PageData['savedPlaylists'] | undefined;
	$effect(() => {
		if (data.savedPlaylists !== previousSnapshot && !data.savedUnavailable) {
			previousSnapshot = data.savedPlaylists;
			customPlaylists.playlists = data.savedPlaylists ?? [];
			loadedServerPlaylists = true;
		}
	});
	const matching = (item: { title?: string; name?: string; artists?: { name: string }[] }) =>
		[item.title, item.name, ...(item.artists?.map((artist) => artist.name) ?? [])].some((text) =>
			text?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
		);
	const visiblePlaylists = $derived(
		(loadedServerPlaylists ? customPlaylists.playlists : (data.savedPlaylists ?? []))
			.filter((playlist) => matching(playlist) || playlist.items.some(matching))
			.toSorted((a, b) =>
				sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)
			)
	);
	const visibleSections = $derived(
		data.sections?.map((section) =>
			section.ok ? { ...section, items: section.items.filter(matching) } : section
		)
	);

	function downloadPlaylist(playlistId: string, format: 'm3u8' | 'json' = 'm3u8') {
		const url = `/api/playlists/${encodeURIComponent(playlistId)}/export?format=${format}`;
		const a = document.createElement('a');
		a.href = url;
		a.download = '';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	const sectionLabel: Record<string, () => string> = {
		albums: m.search_albums,
		artists: m.search_artists,
		tracks: m.search_tracks,
		playlists: m.search_playlists
	};
</script>

<svelte:head>
	<title>{m.library_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.library_subtitle()} />
</svelte:head>

<section class="library" aria-labelledby="library-title">
	<ViewHeader
		eyebrow={m.view_eyebrow_library()}
		title={m.library_title()}
		titleId="library-title"
		description={m.library_subtitle()}
	/>

	<nav class="library-views" aria-label={m.library_view_label()}>
		<button type="button" aria-pressed={view === 'saved'} onclick={() => (view = 'saved')}
			>{m.library_view_saved()}</button
		>
		<button type="button" aria-pressed={view === 'tidal'} onclick={() => (view = 'tidal')}
			>{m.library_view_tidal()}</button
		>
		<button type="button" aria-pressed={view === 'private'} onclick={() => (view = 'private')}
			>{m.library_view_private()}</button
		>
	</nav>
	{#if view !== 'private'}
		<form class="library-filter" role="search" onsubmit={(event) => event.preventDefault()}>
			<SearchField
				id="desktop-library-filter"
				label={m.library_filter_label()}
				placeholder={m.library_filter_placeholder()}
				value={query}
				oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
				onclear={() => (query = '')}
			/>
			{#if view === 'saved'}<label
					>{m.library_sort()}<select bind:value={sort}
						><option value="recent">{m.library_sort_recent()}</option><option value="name"
							>{m.library_sort_name()}</option
						></select
					></label
				>{/if}
		</form>
	{/if}
	{#if view === 'private'}<PrivateMusicShelf library={data.privateMusic} />
	{:else if view === 'saved'}
		<!-- Custom Playlists Section -->
		<section class="custom-pl-block" aria-labelledby="user-playlists-title">
			<SectionHeader
				title={m.library_custom_title()}
				titleId="user-playlists-title"
				count={visiblePlaylists.length}
			>
				{#snippet actions()}
					{#if data.connected}
						<Button variant="secondary" onclick={() => customPlaylists.openImport()}>
							<ArrowDownToLine size={14} />
							{m.playlist_import()}
						</Button>
						<Button
							variant="secondary"
							disabled={customPlaylists.isSyncing}
							onclick={async () => {
								await customPlaylists.syncAll();
							}}
						>
							<RefreshCw size={14} class={customPlaylists.isSyncing ? 'animate-spin' : ''} />
							{m.playlist_sync_all()}
						</Button>
					{/if}
					<Button href={resolve('/app/generate')} variant="primary">
						<Sparkles size={14} />
						{m.nav_generate()}
					</Button>
				{/snippet}
			</SectionHeader>

			{#if data.savedUnavailable}<Notice tone="danger">{m.library_section_error()}</Notice><Button
					onclick={invalidateAll}>{m.track_retry()}</Button
				>
			{:else if visiblePlaylists.length === 0}
				<p class="group-empty">
					{query.trim() ? m.library_no_matches({ query: query.trim() }) : m.library_custom_empty()}
				</p>
			{:else}
				<div class="custom-grid">
					{#each visiblePlaylists as playlist (playlist.id)}
						<article class="custom-card">
							<div class="card-top">
								<div class="saved-cover"><PlaylistCover tracks={playlist.items} size={160} /></div>
								<div class="min-w-0 flex-1">
									<a
										class="block truncate hover:text-(--action) hover:underline"
										href={resolve('/app/playlists/[id]', { id: playlist.id })}
									>
										<strong class="truncate">{playlist.title}</strong>
									</a>
									<div class="card-meta-row">
										<span class="font-mono text-xs text-(--text-muted)"
											>{m.now_library_count({ count: playlist.items.length })}</span
										>
										{#if playlist.syncStatus === 'synced'}
											<span class="sync-dot sync-synced" title={m.playlist_synced()}></span>
										{:else if playlist.syncStatus === 'pending_push'}
											<span class="sync-dot sync-pending" title={m.playlist_pending_push()}></span>
										{:else if playlist.syncStatus === 'error'}
											<span
												class="sync-dot sync-error"
												title={playlist.syncError || m.playlist_sync_error()}
											></span>
										{/if}
									</div>
								</div>
							</div>
							<div class="card-bottom">
								<button
									type="button"
									class="card-play-btn"
									disabled={playlist.items.length === 0}
									onclick={() => customPlaylists.playPlaylist(playlist.id)}
								>
									<Play size={12} fill="currentColor" />
									{m.track_action_play_now()}
								</button>
								{#if (playlist.tidalPlaylistId || playlist.source === 'syn') && !(playlist.source === 'tidal' && playlist.syncStatus === 'local_only')}
									<button
										type="button"
										class="card-sync-btn"
										disabled={customPlaylists.isSyncing}
										title={m.playlist_sync()}
										onclick={() => customPlaylists.syncPlaylist(playlist.id)}
									>
										<RefreshCw size={12} class={customPlaylists.isSyncing ? 'animate-spin' : ''} />
									</button>
								{/if}
								<button
									type="button"
									class="card-export-btn"
									disabled={playlist.items.length === 0}
									title={m.action_export_m3u8()}
									onclick={() => downloadPlaylist(playlist.id, 'm3u8')}
								>
									<Download size={12} />
									M3U8
								</button>
								<button
									type="button"
									class="card-del-btn"
									onclick={() => void customPlaylists.deletePlaylist(playlist.id)}
									title={m.action_delete()}
									aria-label={m.action_delete_playlist()}
								>
									<Trash2 size={13} />
								</button>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{:else}
		{#if !data.connected}
			<StateCard
				state="not_connected"
				title={m.search_not_connected_title()}
				description={m.search_not_connected_description()}
			/>
		{:else if data.sections}
			<section class="tidal-library" aria-labelledby="tidal-library-title">
				<SectionHeader title={m.library_tidal_title()} titleId="tidal-library-title" />
				{#each visibleSections ?? [] as section (section.kind)}
					<section class="result-group" aria-labelledby="{section.kind}-title">
						<SectionHeader
							title={sectionLabel[section.kind]()}
							titleId="{section.kind}-title"
							count={section.ok && section.items ? section.items.length : undefined}
							subtitle={section.ok && section.hasMore ? m.library_has_more() : undefined}
						/>

						{#if !section.ok}
							<Notice tone="danger">{m.library_section_error()}</Notice>
						{:else if section.items.length === 0}
							<p class="group-empty">{m.library_section_empty()}</p>
						{:else if section.kind === 'tracks'}
							<div class="song-cards-grid">
								{#each section.items as track, index (track.id)}
									<SongCard
										track={track as unknown as TrackSummary}
										contextTracks={section.items as unknown as TrackSummary[]}
										{index}
									/>
								{/each}
							</div>
						{:else}
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{#each section.items as item (item.id)}
									<MediaCard
										{item}
										kind={section.kind === 'albums'
											? 'album'
											: section.kind === 'artists'
												? 'artist'
												: 'playlist'}
									/>
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</section>
		{/if}
	{/if}
	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>

	<PlaylistImportModal />
</section>

<style>
	.library {
		max-width: 72rem;
		min-width: 0;
	}

	.library-views {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.library-views button {
		min-height: 3rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		padding: 0.6rem 1rem;
		background: var(--surface-raised);
		color: var(--text-primary);
		font: inherit;
		cursor: pointer;
	}
	.library-views button[aria-pressed='true'] {
		background: var(--surface-selected);
		border-color: var(--action);
		color: var(--action);
	}
	.library-filter {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1.5rem;
	}
	.library-filter :global(.search-field) {
		flex: 1;
		min-width: min(100%, 20rem);
	}
	.library-filter label {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		color: var(--text-muted);
	}
	select {
		min-height: 3rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		padding-inline: 0.75rem;
		font: inherit;
	}
	.library-views button:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.custom-pl-block {
		margin-bottom: 3rem;
		padding: 1.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-panel);
	}

	.custom-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.saved-cover {
		width: 4rem;
		height: 4rem;
		flex-shrink: 0;
		border-radius: var(--radius-md);
	}
	.custom-card {
		padding: 1rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.85rem;
		transition: all 0.12s ease;
	}

	.custom-card:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.card-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.card-bottom {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border-top: 1px dashed var(--border-subtle);
		padding-top: 0.65rem;
	}

	.card-play-btn,
	.card-export-btn,
	.card-del-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		font-size: 0.72rem;
		font-weight: 700;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.card-play-btn {
		background: var(--action);
		color: var(--action-contrast);
		border-color: var(--action);
	}

	.card-play-btn:hover:not(:disabled) {
		background: var(--accent-gold-deep);
		transform: scale(1.03);
	}

	.card-export-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.card-del-btn {
		padding: 0.35rem 0.45rem;
		color: var(--text-muted);
		margin-left: auto;
	}

	.card-del-btn:hover {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-subtle);
	}

	.card-sync-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.45rem;
		font-size: 0.72rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.card-sync-btn:hover:not(:disabled) {
		color: var(--action);
		border-color: var(--action);
	}

	.card-meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.15rem;
	}

	.sync-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 9999px;
		display: inline-block;
		flex-shrink: 0;
	}

	.sync-synced {
		background: var(--success);
		box-shadow: 0 0 4px color-mix(in srgb, var(--success) 50%, transparent);
	}

	.sync-pending {
		background: var(--warning);
		box-shadow: 0 0 4px color-mix(in srgb, var(--warning) 50%, transparent);
	}

	.sync-error {
		background: var(--danger);
		box-shadow: 0 0 4px color-mix(in srgb, var(--danger) 50%, transparent);
	}

	.result-group {
		margin-top: 3rem;
	}

	.group-empty {
		padding: 1.5rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		font-size: 0.88rem;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.15rem;
	}

	.attribution {
		margin-top: 3.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}
</style>
