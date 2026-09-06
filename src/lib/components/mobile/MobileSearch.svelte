<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		Album,
		ListPlus,
		ListStart,
		Loader2,
		Play,
		Radio,
		Search,
		UserRound
	} from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import MobileTrackRow from './MobileTrackRow.svelte';

	import type {
		AlbumSummary,
		ArtistSummary,
		PlaylistSummary,
		SearchResultGroups,
		TrackSummary
	} from '#lib/tidal/models';

	const MINIMUM_QUERY_LENGTH = 2;
	const EMPTY_RESULTS: SearchResultGroups = {
		tracks: [],
		albums: [],
		artists: [],
		playlists: []
	};

	type SearchError = 'not_connected' | 'unauthorized' | 'unavailable' | null;

	let query = $state('');
	let results = $state<SearchResultGroups | null>(null);
	let isSearching = $state(false);
	let error = $state<SearchError>(null);
	let startingRadioId = $state<string | null>(null);
	let radioError = $state<string | null>(null);
	let radioController: AbortController | undefined;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;
	let requestVersion = 0;

	const trimmedQuery = $derived(query.trim());
	const hasResults = $derived(
		Boolean(
			results &&
			(results.tracks.length ||
				results.albums.length ||
				results.artists.length ||
				results.playlists.length)
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

	function cancelSearch(): void {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = undefined;
		controller?.abort();
		controller = undefined;
		requestVersion += 1;
		isSearching = false;
	}

	function searchFromQuery(searchQuery: string, delay = 250): void {
		results = null;
		error = null;
		cancelSearch();
		if (searchQuery.length < MINIMUM_QUERY_LENGTH) return;

		const version = requestVersion;
		isSearching = true;
		if (delay === 0) {
			void search(searchQuery, version);
			return;
		}
		debounceTimer = setTimeout(() => void search(searchQuery, version), delay);
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
		searchFromQuery(nextQuery, 0);
	}

	function handleInput(event: Event): void {
		cancelRadio();
		query = (event.currentTarget as HTMLInputElement).value;
		const searchQuery = query.trim();
		updateUrl(searchQuery);
		searchFromQuery(searchQuery);
	}

	function submit(): void {
		const searchQuery = query.trim();
		updateUrl(searchQuery);
		searchFromQuery(searchQuery, 0);
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
				results = body.results ?? EMPTY_RESULTS;
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
		cancelRadio();
		player.play(track, results?.tracks, m.now_search_provenance({ query: trimmedQuery }));
	}

	async function startRadio(track: TrackSummary): Promise<void> {
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

	function artistLine(item: TrackSummary | AlbumSummary): string {
		return item.artists.map((artist) => artist.name).join(', ');
	}

	function resultHref(item: AlbumSummary | ArtistSummary | PlaylistSummary): string {
		switch (item.kind) {
			case 'album':
				return resolve('/app/albums/[id]', { id: item.id });
			case 'artist':
				return resolve('/app/artists/[id]', { id: item.id });
			case 'playlist':
				return resolve('/app/playlists/[id]', { id: item.id });
		}
	}
</script>

<svelte:window onpopstate={restoreFromUrl} />

<section class="mobile-search" aria-labelledby="mobile-search-title">
	<header>
		<h1 id="mobile-search-title">{m.now_search_heading()}</h1>
	</header>

	<form
		role="search"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<label class="sr-only" for="mobile-search-input">{m.now_search_label()}</label>
		<div class="search-field">
			<Search size={18} aria-hidden="true" />
			<input
				id="mobile-search-input"
				type="search"
				value={query}
				oninput={handleInput}
				placeholder={m.now_search_placeholder()}
				maxlength="160"
				autocomplete="off"
			/>
			{#if isSearching}<Loader2
					class="animate-spin"
					size={18}
					aria-label={m.search_live_searching()}
				/>{/if}
		</div>
	</form>

	{#if trimmedQuery.length < MINIMUM_QUERY_LENGTH}
		<p class="state-message">{m.now_search_prompt()}</p>
	{:else if error === 'not_connected'}
		<p class="state-message" role="status">{m.search_not_connected_title()}</p>
		<a class="recovery-action" href={resolve('/app/settings/tidal')}>{m.tidal_connect()}</a>
	{:else if error === 'unauthorized'}
		<a class="recovery-action" href={resolve('/sign-in')}>{m.sign_in_button()}</a>
	{:else if error === 'unavailable'}
		<p class="state-message" role="alert">{m.now_search_unavailable()}</p>
		<button class="recovery-action" type="button" onclick={submit}>{m.track_retry()}</button>
	{:else if isSearching}
		<p class="state-message" role="status">{m.search_live_searching()}</p>
	{:else if !isSearching && results && !hasResults}
		<p class="state-message" role="status">{m.search_no_results_title({ query: trimmedQuery })}</p>
	{:else if results}
		<div class="result-groups">
			{#if results.tracks.length}
				<section aria-labelledby="mobile-search-tracks">
					<h2 id="mobile-search-tracks">{m.search_tracks()}</h2>
					<div class="track-list">
						{#each results.tracks as track (track.id)}
							<MobileTrackRow {track} onActivate={() => play(track)}>
								{#snippet actions()}
									<div class="track-actions">
										<button
											type="button"
											onclick={() => play(track)}
											aria-label={m.player_play_track()}
										>
											<Play size={16} fill="currentColor" />
										</button>
										<button
											type="button"
											onclick={() =>
												player.playNext(track, m.now_search_provenance({ query: trimmedQuery }))}
											aria-label={m.player_play_next()}
										>
											<ListStart size={16} />
										</button>
										<button
											type="button"
											onclick={() =>
												player.addToQueue(track, m.now_search_provenance({ query: trimmedQuery }))}
											aria-label={m.player_add_to_queue()}
										>
											<ListPlus size={16} />
										</button>
										<button
											type="button"
											onclick={() => void startRadio(track)}
											disabled={startingRadioId !== null}
											aria-busy={startingRadioId === track.id}
											aria-label={m.player_start_radio()}
										>
											<Radio size={16} />
										</button>
									</div>
								{/snippet}
							</MobileTrackRow>
						{/each}
					</div>
				</section>
			{/if}

			{#if results.albums.length || results.artists.length || results.playlists.length}
				<section aria-labelledby="mobile-search-catalogue">
					<h2 id="mobile-search-catalogue">{m.search_title()}</h2>
					<div class="catalogue-list">
						{#each results.albums as album (album.id)}
							<a href={resultHref(album)} class="catalogue-result">
								<Album size={18} aria-hidden="true" />
								<span><strong>{album.title}</strong><small>{artistLine(album)}</small></span>
							</a>
						{/each}
						{#each results.artists as artist (artist.id)}
							<a href={resultHref(artist)} class="catalogue-result">
								<UserRound size={18} aria-hidden="true" />
								<span><strong>{artist.name}</strong><small>{m.search_artists()}</small></span>
							</a>
						{/each}
						{#each results.playlists as playlist (playlist.id)}
							<a href={resultHref(playlist)} class="catalogue-result">
								<Album size={18} aria-hidden="true" />
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
		padding: 1.5rem;
	}
	header {
		margin-bottom: 1rem;
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	h1 {
		font-size: 1.5rem;
	}
	h2 {
		margin-bottom: 0.5rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.search-field {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		padding: 0.7rem 0.8rem;
		color: var(--text-muted);
	}
	.search-field:focus-within {
		border-color: var(--action);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--action) 20%, transparent);
		color: var(--action);
	}
	input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		outline: 0;
	}
	.state-message {
		padding: 2.5rem 0.25rem;
		color: var(--text-muted);
		text-align: center;
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
	.track-actions {
		display: flex;
		flex: none;
		gap: 0.15rem;
	}
	.track-actions button {
		display: grid;
		width: 3rem;
		height: 3rem;
		place-items: center;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
	}
	.track-actions button:active,
	.track-actions button:focus-visible {
		background: var(--surface-selected);
		color: var(--action);
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.track-actions button:disabled {
		opacity: 0.5;
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
