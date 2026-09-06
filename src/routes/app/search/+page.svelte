<script lang="ts">
	import { goto } from '$app/navigation';
	import { Loader2, Search } from '@lucide/svelte';
	import { onDestroy } from 'svelte';

	import MediaCard from '#lib/components/music/MediaCard.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import TrackTable from '#lib/components/music/TrackTable.svelte';
	import TrackQueueActions from '#lib/components/music/TrackQueueActions.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import { m } from '#lib/paraglide/messages';
	import type { SearchResultGroups } from '#lib/tidal/models';
	import { parseTidalResource } from '#lib/tidal/resource';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let liveResults = $state<SearchResultGroups | null>(null);
	let isSearching = $state(false);
	let urlDetected = $state<string | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
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
		void goto(url, { state: {}, shallow: true, replace: true });
	}

	function cancelLiveSearch() {
		clearTimeout(debounceTimer);
		searchRequestVersion += 1;
		activeAbortController?.abort();
		activeAbortController = null;
	}

	function startLiveSearch(query: string, delay = 0) {
		cancelLiveSearch();
		const requestVersion = searchRequestVersion;
		liveResults = null;
		liveError = null;
		isLiveSearch = true;
		isSearching = true;

		if (delay) {
			debounceTimer = setTimeout(() => {
				void runLiveSearch(query, requestVersion);
			}, delay);
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
			if (q) {
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

		cancelLiveSearch();
		if (!trimmed) {
			liveResults = { tracks: [], albums: [], artists: [], playlists: [] };
			liveError = null;
			isLiveSearch = false;
			isSearching = false;
			return;
		}

		if (parsed) {
			liveResults = null;
			liveError = null;
			isLiveSearch = true;
			isSearching = false;
			return;
		}

		startLiveSearch(trimmed, 250);
	}

	async function runLiveSearch(q: string, requestVersion: number) {
		if (requestVersion !== searchRequestVersion) return;

		const controller = new AbortController();
		activeAbortController = controller;

		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error('Search request failed');

			const body = (await res.json()) as { results?: SearchResultGroups };
			if (requestVersion === searchRequestVersion && !controller.signal.aborted) {
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

		const query = searchQuery.trim();
		updateUrl(query);

		if (urlDetected) {
			navigateToResource();
			return;
		}

		if (query) {
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
	<header class="search-header">
		<p class="eyebrow">HALFLIGHT // EXPLORATION</p>
		<h1 id="search-title" class="search-title">{m.search_title()}</h1>
		<p class="intro">{m.search_subtitle()}</p>
	</header>

	<form class="search-form" method="GET" role="search" onsubmit={handleSubmit}>
		<label for="search-query" class="sr-only">{m.search_label()}</label>
		<div class="search-input-wrap">
			<div class="input-container">
				<span class="search-icon"><Search size={18} /></span>
				<input
					id="search-query"
					name="q"
					type="search"
					value={searchQuery}
					oninput={handleInput}
					placeholder={m.search_live_placeholder()}
					maxlength="160"
					autocomplete="off"
				/>
			</div>
			{#if isSearching}
				<div class="search-spinner" aria-label={m.search_live_searching()}>
					<Loader2 class="animate-spin text-(--action)" size={20} />
				</div>
			{:else}
				<Button type="submit" variant="primary">
					{m.search_button()}
				</Button>
			{/if}
		</div>
	</form>

	{#if urlDetected}
		<div class="url-detected-banner" role="alert">
			<span class="url-label">TIDAL LINK DETECTED</span>
			<Button variant="primary" size="sm" onclick={navigateToResource}>OPEN RESOURCE →</Button>
		</div>
	{/if}

	{#if !data.connected}
		<StateCard
			state="not_connected"
			title={m.search_not_connected_title()}
			description={m.search_not_connected_description()}
		/>
	{:else if searchError === 'invalid_query'}
		<p class="state-error" role="alert">{m.search_invalid_query()}</p>
	{:else if searchError === 'unavailable'}
		<p class="state-error" role="alert">{m.search_error()}</p>
	{:else if !activeQuery}
		<StateCard title={m.search_empty_title()} description={m.search_empty_description()} />
	{:else if resultCount === 0 && !isSearching}
		<StateCard
			title={m.search_no_results_title({ query: activeQuery })}
			description={m.search_no_results_description()}
		/>
	{:else if currentResults}
		<div class="result-summary" role="status">
			<p>
				{m.search_results_for({ query: activeQuery })}
				<span class="font-mono text-xs text-(--text-muted)">({resultCount} matches)</span>
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
				>
					{#snippet rowActions(track)}
						<TrackQueueActions {track} provenance={m.search_title()} />
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
	}

	.search-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 1.5rem;
	}

	.search-title {
		margin: 0.25rem 0 0.5rem;
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
		color: var(--text-primary);
	}

	.intro {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.search-form {
		margin-bottom: 1.5rem;
	}

	.search-input-wrap {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.input-container {
		position: relative;
		flex: 1;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	input[type='search'] {
		width: 100%;
		padding: 0.75rem 1rem 0.75rem 2.85rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.95rem;
		transition: all 0.12s ease;
	}

	input[type='search']:focus {
		border-color: var(--action);
		background: var(--surface-selected);
		outline: none;
		box-shadow: var(--shadow-panel);
	}

	.search-spinner {
		display: grid;
		place-items: center;
		padding: 0 1rem;
	}

	.url-detected-banner {
		display: flex;
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
