<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import SearchField from '#lib/components/ui/SearchField.svelte';
	import PlayedSearchHistory from '#lib/components/music/PlayedSearchHistory.svelte';
	import { searchHistory } from '#lib/search/history.svelte';
	import { player } from '#lib/player/player.svelte';
	import { LiveSearchScheduler } from '#lib/search/live-search';

	import MediaCard from '#lib/components/music/MediaCard.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import TrackTable from '#lib/components/music/TrackTable.svelte';
	import TrackQueueActions from '#lib/components/music/TrackQueueActions.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import { m } from '#lib/paraglide/messages';
	import type { SearchResultGroups } from '#lib/tidal/models';
	import { parseTidalResource } from '#lib/tidal/resource';
	import Notice from '#lib/components/ui/Notice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let resultsQuery = $state('');
	let input = $state<HTMLInputElement>();
	let composing = $state(false);
	let liveResults = $state<SearchResultGroups | null>(null);
	let isSearching = $state(false);
	let urlDetected = $state<string | null>(null);
	const scheduler = new LiveSearchScheduler();
	let activeAbortController: AbortController | null = null;
	let searchRequestVersion = 0;
	let liveError = $state<'unavailable' | null>(null);
	let isLiveSearch = $state(false);
	let lastPropQuery = $state<string | undefined>(undefined);

	$effect.pre(() => {
		if (data.query !== lastPropQuery) {
			cancelLiveSearch();
			lastPropQuery = data.query;
			searchQuery = data.query ?? '';
			resultsQuery = searchQuery;
			urlDetected = parseTidalResource(searchQuery)?.appPath ?? null;
			liveResults = data.results ?? null;
			liveError = null;
			isLiveSearch = false;
		}
	});

	onDestroy(cancelLiveSearch);

	function updateUrl(query: string) {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		if (query) {
			url.searchParams.set('q', query);
			url.searchParams.delete('search');
		} else {
			url.searchParams.delete('q');
			url.searchParams.delete('search');
		}
		void goto(url, { state: {}, shallow: true, replace: true, reset: false });
	}

	function cancelLiveSearch(preserveBurst = false) {
		scheduler.cancel(preserveBurst);
		isSearching = false;
		searchRequestVersion += 1;
		activeAbortController?.abort();
		activeAbortController = null;
	}

	function startLiveSearch(query: string, immediate = true) {
		cancelLiveSearch(!immediate);
		const requestVersion = searchRequestVersion;
		liveResults ??= data.results ?? null;
		liveError = null;
		isLiveSearch = true;
		isSearching = true;

		if (!immediate) {
			scheduler.schedule(() => void runLiveSearch(query, requestVersion));
			return;
		}

		void runLiveSearch(query, requestVersion);
	}

	function handlePopState() {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		const q = (url.searchParams.get('q') ?? url.searchParams.get('search') ?? '').trim();
		if (q !== searchQuery) {
			searchQuery = q;
			urlDetected = parseTidalResource(q)?.appPath ?? null;
			if (q.length >= 2 && !urlDetected) {
				startLiveSearch(q);
			} else {
				cancelLiveSearch();
				liveResults = { tracks: [], albums: [], artists: [], playlists: [] };
				liveError = null;
				isLiveSearch = false;
				isSearching = false;
			}
		}
	}

	const currentResults = $derived(isLiveSearch ? liveResults : data.results);
	const activeQuery = $derived(searchQuery.trim());
	const searchError = $derived(
		liveError ?? (activeQuery === data.query.trim() ? data.error : null)
	);

	const resultCount = $derived(
		currentResults
			? currentResults.tracks.length +
					currentResults.albums.length +
					currentResults.artists.length +
					currentResults.playlists.length
			: 0
	);

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const query = target.value;
		searchQuery = query;

		const trimmed = query.trim();

		// Keep ?search=<typed in search result> updated in the URL
		updateUrl(trimmed);

		// Check if user pasted a TIDAL URL or shorthand
		const parsed = parseTidalResource(trimmed);
		if (parsed) {
			urlDetected = parsed.appPath;
		} else {
			urlDetected = null;
		}

		cancelLiveSearch(true);
		if (trimmed.length < 2) {
			liveResults = { tracks: [], albums: [], artists: [], playlists: [] };
			liveError = null;
			isLiveSearch = true;
			isSearching = false;
			scheduler.cancel();
			return;
		}

		if (parsed) {
			scheduler.cancel();
			liveResults = null;
			liveError = null;
			isLiveSearch = true;
			isSearching = false;
			return;
		}

		startLiveSearch(trimmed, false);
	}

	async function runLiveSearch(q: string, requestVersion: number) {
		if (requestVersion !== searchRequestVersion) return;

		const controller = new AbortController();
		activeAbortController = controller;
		const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);

		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
				signal
			});
			signal.throwIfAborted();
			if (!res.ok) throw new Error('Search request failed');

			const body = (await res.json()) as { results?: SearchResultGroups };
			signal.throwIfAborted();
			if (requestVersion === searchRequestVersion && !controller.signal.aborted) {
				resultsQuery = q;
				liveResults = body.results ?? { tracks: [], albums: [], artists: [], playlists: [] };
			}
		} catch (err: unknown) {
			if (
				requestVersion !== searchRequestVersion ||
				controller.signal.aborted ||
				(err instanceof DOMException && err.name === 'AbortError')
			) {
				return;
			}
			liveResults = null;
			liveError = 'unavailable';
		} finally {
			if (requestVersion === searchRequestVersion && activeAbortController === controller) {
				isSearching = false;
				activeAbortController = null;
			}
		}
	}

	function navigateToResource() {
		if (urlDetected) {
			void goto(urlDetected);
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (composing) return;

		const query = searchQuery.trim();
		updateUrl(query);

		if (urlDetected) {
			navigateToResource();
			return;
		}

		if (query.length >= 2) {
			startLiveSearch(query);
		} else {
			cancelLiveSearch();
			liveResults = { tracks: [], albums: [], artists: [], playlists: [] };
			liveError = null;
			isLiveSearch = false;
			isSearching = false;
		}
	}
</script>

<svelte:window onpopstate={handlePopState} />

<svelte:head>
	<title>{m.search_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.search_subtitle()} />
</svelte:head>

<section class="search-page" aria-labelledby="search-title">
	<ViewHeader
		eyebrow={m.view_eyebrow_search()}
		title={m.search_title()}
		titleId="search-title"
		description={m.search_subtitle()}
	/>

	<form class="search-form" method="GET" role="search" onsubmit={handleSubmit}>
		<SearchField
			id="search-query"
			label={m.search_label()}
			placeholder={m.search_live_placeholder()}
			value={searchQuery}
			searching={isSearching}
			oninput={handleInput}
			bind:input
			bind:composing
			shortcut
			oncompositionstart={() => cancelLiveSearch()}
			onclear={() => {
				cancelLiveSearch();
				searchQuery = '';
				urlDetected = null;
				liveResults = null;
				liveError = null;
				isLiveSearch = true;
				updateUrl('');
			}}
		/>
	</form>

	{#if urlDetected}
		<div class="url-detected-banner" role="status">
			<span class="url-label">{m.search_link_detected()}</span>
			<Button variant="primary" size="sm" onclick={navigateToResource}
				>{m.search_header_open_resource()}</Button
			>
		</div>
	{/if}

	{#if !data.connected}
		<StateCard
			state="not_connected"
			title={m.search_not_connected_title()}
			description={m.search_not_connected_description()}
		/>
	{:else if searchError === 'invalid_query'}
		<Notice tone="danger">{m.search_invalid_query()}</Notice>
	{:else if searchError === 'unavailable'}
		<Notice tone="danger">{m.search_error()}</Notice>
		<Button onclick={() => startLiveSearch(activeQuery)}>{m.track_retry()}</Button>
	{:else if !activeQuery}
		<!-- Result caches and listening history never populate search history. -->
		{#if searchHistory.entries.length}<PlayedSearchHistory />{:else}<StateCard
				title={m.search_empty_title()}
				description={m.search_empty_description()}
			/>{/if}
	{:else if activeQuery.length < 2}
		<StateCard title={m.search_minimum()} description={m.search_empty_description()} />
	{:else if isSearching && !currentResults}
		<p class="result-summary" role="status">{m.search_live_searching()}</p>
	{:else if resultCount === 0 && !isSearching && !urlDetected}
		<StateCard
			title={m.search_no_results_title({ query: activeQuery })}
			description={m.search_no_results_description()}
		/>
	{:else if currentResults}
		<div class="result-summary" role="status">
			<p>
				{m.search_results_for({ query: resultsQuery || activeQuery })}
				<span class="font-mono text-xs text-(--text-muted)"
					>({m.search_matches({ count: resultCount })})</span
				>
			</p>
		</div>

		{#if currentResults.tracks.length}
			<section class="result-group" aria-labelledby="tracks-title">
				<SectionHeader
					title={m.search_tracks()}
					titleId="tracks-title"
					count={currentResults.tracks.length}
				/>
				<TrackTable
					tracks={currentResults.tracks}
					contextTracks={currentResults.tracks}
					provenance={m.search_title()}
					columns={['album', 'date', 'duration']}
					onRowActivate={(track, index) =>
						player.playFromSearch(
							track,
							currentResults?.tracks,
							resultsQuery || activeQuery,
							index
						)}
				>
					{#snippet rowActions(track)}
						<TrackQueueActions
							searchQuery={resultsQuery || activeQuery}
							{track}
							provenance={m.search_title()}
							onPlayNow={() =>
								player.playFromSearch(track, currentResults?.tracks, resultsQuery || activeQuery)}
						/>
					{/snippet}
				</TrackTable>
			</section>
		{/if}

		{#if currentResults.albums.length}
			<section class="result-group" aria-labelledby="albums-title">
				<SectionHeader
					title={m.search_albums()}
					titleId="albums-title"
					count={currentResults.albums.length}
				/>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each currentResults.albums as album (album.id)}
						<MediaCard item={album} kind="album" />
					{/each}
				</div>
			</section>
		{/if}

		{#if currentResults.artists.length}
			<section class="result-group" aria-labelledby="artists-title">
				<SectionHeader
					title={m.search_artists()}
					titleId="artists-title"
					count={currentResults.artists.length}
				/>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each currentResults.artists as artist (artist.id)}
						<MediaCard item={artist} kind="artist" />
					{/each}
				</div>
			</section>
		{/if}

		{#if currentResults.playlists.length}
			<section class="result-group" aria-labelledby="playlists-title">
				<SectionHeader
					title={m.search_playlists()}
					titleId="playlists-title"
					count={currentResults.playlists.length}
				/>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each currentResults.playlists as playlist (playlist.id)}
						<MediaCard item={playlist} kind="playlist" />
					{/each}
				</div>
			</section>
		{/if}
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.search-page {
		max-width: 72rem;
		min-width: 0;
	}

	.search-form {
		margin-bottom: 1.5rem;
	}

	.url-detected-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1.25rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-md);
		background: color-mix(in oklch, var(--action) 12%, var(--surface-canvas));
		margin-bottom: 1.5rem;
	}

	.url-label {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: var(--action);
	}

	.result-summary {
		padding: 0.75rem 1rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		margin-bottom: 2rem;
		font-size: 0.9rem;
	}

	.result-summary p {
		margin: 0;
	}

	.result-group {
		margin-top: 3rem;
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
