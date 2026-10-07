<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Album, ExternalLink, ListMusic, UserRound } from '@lucide/svelte';
	import { getContext, onDestroy, onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { MobileSearchSession, MOBILE_SEARCH_SESSION } from '#lib/mobile/search-session.svelte.js';
	import MobileScreenHeader from './MobileScreenHeader.svelte';
	import SearchField from '#lib/components/ui/SearchField.svelte';
	import PlayedSearchHistory from '#lib/components/music/PlayedSearchHistory.svelte';
	import { searchHistory } from '#lib/search/history.svelte';
	import { LiveSearchScheduler } from '#lib/search/live-search';
	import { parseTidalResource } from '#lib/tidal/resource';
	import MobileTrackRow from './MobileTrackRow.svelte';

	import type {
		AlbumSummary,
		ArtistSummary,
		PlaylistSummary,
		SearchResultGroups,
		TrackSummary
	} from '#lib/tidal/models';

	const MINIMUM_QUERY_LENGTH = 2;
	const searchSession =
		getContext<MobileSearchSession | undefined>(MOBILE_SEARCH_SESSION) ?? new MobileSearchSession();
	const EMPTY_RESULTS: SearchResultGroups = {
		tracks: [],
		albums: [],
		artists: [],
		playlists: []
	};

	type SearchError = 'not_connected' | 'unauthorized' | 'unavailable' | null;

	let query = $state('');
	let resultsQuery = $state('');
	let input = $state<HTMLInputElement>();
	let composing = $state(false);
	let results = $state<SearchResultGroups | null>(null);
	let isSearching = $state(false);
	let error = $state<SearchError>(null);
	let startingRadioId = $state<string | null>(null);
	let radioError = $state<string | null>(null);
	let radioController: AbortController | undefined;
	const scheduler = new LiveSearchScheduler();
	let controller: AbortController | undefined;
	let requestVersion = 0;

	const trimmedQuery = $derived(query.trim());
	const visibleResults = $derived(results);
	const visibleQuery = $derived(resultsQuery || trimmedQuery);
	const hasVisibleResults = $derived(
		Boolean(
			visibleResults &&
			(visibleResults.tracks.length ||
				visibleResults.albums.length ||
				visibleResults.artists.length ||
				visibleResults.playlists.length)
		)
	);

	onMount(restoreFromUrl);

	onDestroy(() => {
		cancelSearch();
		cancelRadio();
	});

	function cancelRadio(): void {
		radioController?.abort();
		radioController = undefined;
		startingRadioId = null;
		radioError = null;
	}

	function cancelSearch(preserveBurst = false): void {
		scheduler.cancel(preserveBurst);
		controller?.abort();
		controller = undefined;
		requestVersion += 1;
		isSearching = false;
	}

	function searchFromQuery(searchQuery: string, immediate = false): void {
		if (searchSession.lastQuery === searchQuery) {
			results = searchSession.lastResults;
			resultsQuery = searchQuery;
		}
		error = null;
		cancelSearch(!immediate);
		if (searchQuery.length < MINIMUM_QUERY_LENGTH || mobileResourceHref(searchQuery)) {
			scheduler.cancel();
			return;
		}

		const version = requestVersion;
		isSearching = true;
		if (immediate) {
			void search(searchQuery, version);
			return;
		}
		scheduler.schedule(() => void search(searchQuery, version));
	}

	function updateUrl(searchQuery: string): void {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		if (searchQuery) url.searchParams.set('q', searchQuery);
		else url.searchParams.delete('q');
		void goto(url, { replace: true, reset: false, shallow: true });
	}

	function restoreFromUrl(): void {
		if (typeof window === 'undefined') return;
		const urlQuery = new URL(window.location.href).searchParams.get('q');
		const nextQuery = urlQuery?.trim().slice(0, 160) ?? '';
		if (nextQuery === query) return;
		query = nextQuery;
		searchFromQuery(nextQuery, true);
	}

	function handleInput(event: Event): void {
		cancelRadio();
		query = (event.currentTarget as HTMLInputElement).value;
		const searchQuery = query.trim();
		updateUrl(searchQuery);
		searchFromQuery(searchQuery);
	}

	function submit(): void {
		if (composing) return;
		input?.blur();
		const href = mobileResourceHref(query);
		if (href) {
			void goto(href);
			return;
		}
		const searchQuery = query.trim();
		updateUrl(searchQuery);
		searchFromQuery(searchQuery, true);
	}

	async function search(searchQuery: string, version: number): Promise<void> {
		if (version !== requestVersion) return;
		const nextController = new AbortController();
		controller = nextController;
		const signal = AbortSignal.any([nextController.signal, AbortSignal.timeout(12_000)]);

		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
				signal
			});
			signal.throwIfAborted();
			if (version !== requestVersion) return;
			if (!response.ok) {
				error =
					response.status === 401 || response.status === 403
						? 'unauthorized'
						: response.status === 503
							? 'not_connected'
							: 'unavailable';
				return;
			}
			const body = (await response.json()) as { results?: SearchResultGroups };
			signal.throwIfAborted();
			if (version === requestVersion) {
				const nextResults = body.results ?? EMPTY_RESULTS;
				resultsQuery = searchQuery;
				results = nextResults;
				searchSession.remember(searchQuery, nextResults);
			}
		} catch (cause) {
			if (
				version === requestVersion &&
				!(cause instanceof DOMException && cause.name === 'AbortError')
			) {
				error = 'unavailable';
			}
		} finally {
			if (version === requestVersion && controller === nextController) {
				isSearching = false;
				controller = undefined;
			}
		}
	}

	function play(track: TrackSummary): void {
		input?.blur();
		cancelRadio();
		player.playFromSearch(track, visibleResults?.tracks, visibleQuery);
	}

	async function startRadio(track: TrackSummary): Promise<void> {
		input?.blur();
		if (startingRadioId) return;
		startingRadioId = track.id;
		radioError = null;
		const nextController = new AbortController();
		radioController = nextController;
		const signal = AbortSignal.any([nextController.signal, AbortSignal.timeout(20_000)]);
		const currentTrack = player.currentTrack;
		try {
			const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/radio`, { signal });
			if (!response.ok) throw new Error('Radio unavailable');
			const body = (await response.json()) as { tracks?: TrackSummary[] };
			signal.throwIfAborted();
			if (radioController !== nextController || player.currentTrack !== currentTrack) return;
			const tracks = body.tracks ?? [];
			if (!tracks.length) throw new Error('Radio empty');
			player.play(tracks[0], tracks, m.player_radio_provenance({ title: track.title }));
		} catch {
			if (radioController === nextController && !nextController.signal.aborted) {
				radioError = m.player_radio_unavailable();
			}
		} finally {
			if (radioController === nextController) {
				startingRadioId = null;
				radioController = undefined;
			}
		}
	}

	function mobileResourceHref(value: string): string | null {
		const resource = parseTidalResource(value);
		if (!resource) return null;
		switch (resource.type) {
			case 'track':
				return resolve('/(mobile)/tracks/[id]', { id: resource.id });
			case 'album':
				return resolve('/(mobile)/albums/[id]', { id: resource.id });
			case 'artist':
				return resolve('/(mobile)/artists/[id]', { id: resource.id });
			case 'playlist':
				return resolve('/(mobile)/playlists/[id]', { id: resource.id });
			default:
				return null;
		}
	}
	const resourceHref = $derived(mobileResourceHref(query));

	function artistLine(item: TrackSummary | AlbumSummary): string {
		return item.artists.map((artist) => artist.name).join(', ');
	}

	function resultHref(item: AlbumSummary | ArtistSummary | PlaylistSummary): string {
		switch (item.kind) {
			case 'album':
				return resolve('/(mobile)/albums/[id]', { id: item.id });
			case 'playlist':
				return resolve('/(mobile)/playlists/[id]', { id: item.id });
			case 'artist':
				return resolve('/(mobile)/artists/[id]', { id: item.id });
		}
	}
</script>

<svelte:window onpopstate={restoreFromUrl} />

<section class="mobile-search" aria-labelledby="mobile-search-title">
	<MobileScreenHeader heading={m.now_search_heading()} headingId="mobile-search-title" />

	<form
		role="search"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<SearchField
			id="mobile-search-input"
			label={m.now_search_label()}
			placeholder={m.now_search_placeholder()}
			value={query}
			searching={isSearching}
			oninput={handleInput}
			bind:input
			bind:composing
			oncompositionstart={() => {
				cancelSearch();
				cancelRadio();
			}}
			onclear={() => {
				cancelSearch();
				cancelRadio();
				query = '';
				results = null;
				error = null;
				updateUrl('');
			}}
			onkeydown={(event) => {
				if (event.key === 'Escape') input?.blur();
			}}
		/>
	</form>

	{#if isSearching && visibleResults}<p class="last-search-label" role="status">
			{m.search_results_for({ query: visibleQuery })}
		</p>{/if}

	{#if resourceHref}
		<a class="recovery-action resource-link" href={resourceHref} onclick={() => input?.blur()}
			><ExternalLink size={18} aria-hidden="true" />{m.search_header_open_resource()}</a
		>
	{:else if trimmedQuery.length < MINIMUM_QUERY_LENGTH}
		{#if !trimmedQuery && searchHistory.entries.length}<PlayedSearchHistory
				mobile
				onplay={() => input?.blur()}
			/>
		{:else}<p class="state-message">
				{trimmedQuery ? m.search_minimum() : m.now_search_prompt()}
			</p>{/if}
	{:else if error === 'not_connected'}
		<p class="state-message" role="status">{m.search_not_connected_title()}</p>
		<a class="recovery-action" href={resolve('/(mobile)/settings')}>{m.tidal_connect()}</a>
	{:else if error === 'unauthorized'}
		<a class="recovery-action" href={resolve('/sign-in')}>{m.sign_in_button()}</a>
	{:else if error === 'unavailable'}
		<p class="state-message" role="alert">{m.now_search_unavailable()}</p>
		<button class="recovery-action" type="button" onclick={submit}>{m.track_retry()}</button>
	{:else if isSearching && !visibleResults}
		<p class="state-message" role="status">{m.search_live_searching()}</p>
	{:else if !isSearching && visibleResults && !hasVisibleResults}
		<p class="state-message" role="status">{m.search_no_results_title({ query: visibleQuery })}</p>
	{:else if visibleResults}
		<div class="result-groups" aria-busy={isSearching}>
			{#if visibleResults.tracks.length}
				<section aria-labelledby="mobile-search-tracks">
					<h2 id="mobile-search-tracks">{m.search_tracks()}</h2>
					<div class="track-list">
						{#each visibleResults.tracks as track (track.id)}
							<MobileTrackRow
								{track}
								contextTracks={visibleResults.tracks}
								provenance={m.now_search_provenance({ query: visibleQuery })}
								searchQuery={visibleQuery}
								onActivate={() => play(track)}
								onStartRadio={() => startRadio(track)}
								radioDisabled={startingRadioId !== null}
							/>
						{/each}
					</div>
				</section>
			{/if}

			{#if visibleResults.albums.length || visibleResults.artists.length || visibleResults.playlists.length}
				<section aria-labelledby="mobile-search-catalogue">
					<h2 id="mobile-search-catalogue">{m.search_title()}</h2>
					<div class="catalogue-list">
						{#each visibleResults.albums as album (album.id)}
							<a onclick={() => input?.blur()} href={resultHref(album)} class="catalogue-result">
								<Album size={18} aria-hidden="true" />
								<span><strong>{album.title}</strong><small>{artistLine(album)}</small></span>
							</a>
						{/each}
						{#each visibleResults.artists as artist (artist.id)}
							<a onclick={() => input?.blur()} href={resultHref(artist)} class="catalogue-result">
								<UserRound size={18} aria-hidden="true" />
								<span><strong>{artist.name}</strong><small>{m.search_artists()}</small></span>
							</a>
						{/each}
						{#each visibleResults.playlists as playlist (playlist.id)}
							<a onclick={() => input?.blur()} href={resultHref(playlist)} class="catalogue-result">
								<ListMusic size={18} aria-hidden="true" />
								<span
									><strong>{playlist.title}</strong><small
										>{playlist.description ?? m.search_playlists()}</small
									></span
								>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{/if}
	{#if startingRadioId}
		<p role="status">{m.player_starting_radio()}</p>
		<button class="recovery-action" type="button" onclick={cancelRadio}
			>{m.playlist_cancel()}</button
		>
	{/if}
	{#if radioError}<p class="state-message" role="alert">{radioError}</p>{/if}
</section>

<style>
	.mobile-search {
		padding: clamp(1.5rem, 6vw, 2.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		margin-bottom: 0.5rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	form {
		position: sticky;
		top: 0;
		z-index: 5;
		padding-block: 0.75rem;
		background: var(--surface-canvas);
	}
	.resource-link {
		gap: 0.5rem;
		margin-top: 1rem;
		border-radius: var(--radius-md);
	}
	.state-message {
		padding: 2.5rem 0.25rem;
		color: var(--text-muted);
		text-align: center;
	}
	.last-search-label {
		margin-top: 1.1rem;
		padding-inline: 0.25rem;
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}
	.result-groups {
		display: grid;
		gap: 1.75rem;
		margin-top: 1.75rem;
	}
	.track-list,
	.catalogue-list {
		display: grid;
		gap: 0.2rem;
	}
	.catalogue-result {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		padding: 0.75rem 0;
	}
	.catalogue-result {
		min-width: 0;
		flex: 1;
		color: var(--text-primary);
	}
	.catalogue-result {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.catalogue-result > span {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}
	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		color: var(--text-muted);
	}
	.catalogue-result {
		text-decoration: none;
	}
	.recovery-action {
		display: inline-flex;
		align-items: center;
		min-height: 3rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--action);
		font: inherit;
		cursor: pointer;
	}
	.recovery-action:focus-visible,
	.catalogue-result:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
