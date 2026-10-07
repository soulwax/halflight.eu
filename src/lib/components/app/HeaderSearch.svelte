<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Disc3, ExternalLink, ListMusic, Music2, UserRound } from '@lucide/svelte';
	import { onDestroy, tick } from 'svelte';
	import SearchField from '#lib/components/ui/SearchField.svelte';
	import { searchHistory } from '#lib/search/history.svelte';
	import { LiveSearchScheduler } from '#lib/search/live-search';
	import { m } from '#lib/paraglide/messages';
	import type { SearchResult, SearchResultGroups } from '#lib/tidal/models';
	import { parseTidalResource } from '#lib/tidal/resource';

	const MINIMUM_QUERY_LENGTH = 2;
	const RESULT_LIMITS = { tracks: 3, albums: 2, artists: 2, playlists: 2 };

	type SearchKind = keyof SearchResultGroups;
	interface DropdownOption {
		id: string;
		kind: SearchKind;
		result: SearchResult;
		href: string;
	}

	const searchId = $props.id();
	let root: HTMLDivElement;
	let input = $state<HTMLInputElement>();
	let composing = $state(false);
	let query = $state('');
	let resultsQuery = $state('');
	let results = $state<SearchResultGroups | null>(null);
	let isOpen = $state(false);
	let isSearching = $state(false);
	let error = $state<'not_connected' | 'unavailable' | null>(null);
	let resourceHref = $state<string | null>(null);
	let activeIndex = $state(-1);
	const scheduler = new LiveSearchScheduler();
	let controller: AbortController | undefined;
	let requestVersion = 0;

	const options = $derived<DropdownOption[]>(
		results
			? (Object.entries(RESULT_LIMITS).flatMap(([kind, limit]) =>
					(results?.[kind as SearchKind] ?? []).slice(0, limit).map((result) => ({
						id: `${searchId}-${kind}-${result.id}`,
						kind: kind as SearchKind,
						result,
						href: resultHref(result)
					}))
				) satisfies DropdownOption[])
			: []
	);
	const shouldShowDropdown = $derived(
		isOpen &&
			(Boolean(resourceHref) ||
				query.trim().length >= MINIMUM_QUERY_LENGTH ||
				isSearching ||
				Boolean(error))
	);

	const navigationOptions = $derived(
		resourceHref ? [{ id: `${searchId}-resource`, href: resourceHref }] : options
	);

	$effect(() => {
		const option = navigationOptions[activeIndex];
		if (isOpen && option)
			void tick().then(() =>
				document.getElementById(option.id)?.scrollIntoView({ block: 'nearest' })
			);
	});

	onDestroy(cancelSearch);

	function resultHref(result: SearchResult): string {
		switch (result.kind) {
			case 'track':
				return resolve('/app/tracks/[id]', { id: result.id });
			case 'album':
				return resolve('/app/albums/[id]', { id: result.id });
			case 'artist':
				return resolve('/app/artists/[id]', { id: result.id });
			case 'playlist':
				return resolve('/app/playlists/[id]', { id: result.id });
		}
	}

	function kindLabel(kind: SearchKind): string {
		return kind === 'tracks'
			? m.search_tracks()
			: kind === 'albums'
				? m.search_albums()
				: kind === 'artists'
					? m.search_artists()
					: m.search_playlists();
	}

	function titleFor(result: SearchResult): string {
		return result.kind === 'artist' ? result.name : result.title;
	}

	function subtitleFor(result: SearchResult): string {
		if (result.kind === 'track') {
			const artists = result.artists.map((artist) => artist.name).join(', ');
			return result.album ? `${artists} · ${result.album.title}` : artists;
		}
		if (result.kind === 'album') return result.artists.map((artist) => artist.name).join(', ');
		if (result.kind === 'playlist') return result.description ?? m.search_playlists();
		return m.search_artists();
	}

	function cancelSearch(preserveBurst = false): void {
		scheduler.cancel(preserveBurst);
		controller?.abort();
		controller = undefined;
		requestVersion += 1;
		isSearching = false;
	}

	function clearResults(): void {
		results = null;
		error = null;
		resourceHref = null;
		activeIndex = -1;
	}

	function handleInput(event: Event): void {
		query = (event.target as HTMLInputElement).value;
		isOpen = true;
		error = null;
		resourceHref = null;
		activeIndex = -1;
		cancelSearch(true);

		const trimmed = query.trim();
		const resource = parseTidalResource(trimmed);
		if (resource) {
			scheduler.cancel();
			results = null;
			resourceHref = resource.appPath;
			return;
		}
		if (trimmed.length < MINIMUM_QUERY_LENGTH) {
			results = null;
			scheduler.cancel();
			return;
		}

		const version = requestVersion;
		isSearching = true;
		scheduler.schedule(() => void fetchResults(trimmed, version));
	}

	async function fetchResults(searchQuery: string, version: number): Promise<void> {
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
				error = response.status === 503 ? 'not_connected' : 'unavailable';
				return;
			}
			const body = (await response.json()) as { results?: SearchResultGroups };
			if (version === requestVersion && !nextController.signal.aborted) {
				resultsQuery = searchQuery;
				results = body.results ?? { tracks: [], albums: [], artists: [], playlists: [] };
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

	function closeDropdown(): void {
		isOpen = false;
		activeIndex = -1;
	}

	function navigate(href: string): void {
		const option = options.find((item) => item.href === href);
		if (option?.result.kind === 'track') searchHistory.select(option.result, resultsQuery);
		closeDropdown();
		void goto(href);
	}

	function submitSearch(): void {
		const trimmed = query.trim();
		if (!trimmed || composing) return;
		if (resourceHref) {
			navigate(resourceHref);
			return;
		}
		navigate(`${resolve('/app/search')}?q=${encodeURIComponent(trimmed)}`);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.isComposing || composing) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			closeDropdown();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			isOpen = true;
			activeIndex = Math.min(activeIndex + 1, navigationOptions.length - 1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			isOpen = true;
			activeIndex = activeIndex < 0 ? navigationOptions.length - 1 : Math.max(activeIndex - 1, -1);
			return;
		}
		if (event.key === 'Enter' && activeIndex >= 0 && navigationOptions[activeIndex]) {
			event.preventDefault();
			navigate(navigationOptions[activeIndex].href);
		}
	}

	function handleFocusOut(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !root.contains(next)) closeDropdown();
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (event.target instanceof Node && !root?.contains(event.target)) closeDropdown();
	}}
/>

<div class="header-search" bind:this={root} onfocusout={handleFocusOut}>
	<form
		role="search"
		action={resolve('/app/search')}
		onsubmit={(event) => {
			event.preventDefault();
			submitSearch();
		}}
	>
		<SearchField
			id={`${searchId}-input`}
			label={m.search_header_label()}
			placeholder={m.search_header_placeholder()}
			value={query}
			searching={isSearching}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => (isOpen = true)}
			oncompositionstart={cancelSearch}
			onclear={() => {
				cancelSearch();
				clearResults();
				query = '';
				isOpen = false;
			}}
			bind:input
			bind:composing
			combobox
			shortcut
			expanded={shouldShowDropdown}
			controls={shouldShowDropdown ? `${searchId}-results` : undefined}
			activeDescendant={activeIndex >= 0 ? navigationOptions[activeIndex]?.id : undefined}
		/>
	</form>

	{#if shouldShowDropdown}
		<div class="search-dropdown">
			<div id={`${searchId}-results`} role="listbox" aria-label={m.search_header_results()}>
				{#if resourceHref}
					<button
						id={`${searchId}-resource`}
						role="option"
						aria-selected={activeIndex === 0}
						class:active={activeIndex === 0}
						type="button"
						class="resource-result"
						onclick={() => navigate(resourceHref!)}
					>
						<ExternalLink size={16} aria-hidden="true" />
						<span>
							<strong>{m.search_header_open_resource()}</strong>
							<small>{query.trim()}</small>
						</span>
					</button>
				{:else if error === 'not_connected'}
					<p class="dropdown-state" role="status">{m.search_not_connected_title()}</p>
				{:else if error === 'unavailable'}
					<p class="dropdown-state" role="status">{m.search_header_unavailable()}</p>
				{:else if isSearching && !options.length}
					<p class="dropdown-state" role="status">{m.search_live_searching()}</p>
				{:else if options.length === 0 && query.trim().length >= MINIMUM_QUERY_LENGTH}
					<p class="dropdown-state" role="status">{m.search_header_no_results()}</p>
				{:else}
					{#if isSearching}<p class="dropdown-state" role="status">
							{m.search_results_for({ query: resultsQuery })}
						</p>{/if}
					{#each ['tracks', 'albums', 'artists', 'playlists'] as kind (kind)}
						{@const group = options.filter((option) => option.kind === kind)}
						{#if group.length}
							<section class="result-group" role="group" aria-label={kindLabel(kind as SearchKind)}>
								<p class="group-label">{kindLabel(kind as SearchKind)}</p>
								{#each group as option (option.id)}
									<a
										id={option.id}
										class:active={options.indexOf(option) === activeIndex}
										class="dropdown-result"
										href={option.href}
										role="option"
										aria-selected={options.indexOf(option) === activeIndex}
										onclick={() => {
											if (option.result.kind === 'track')
												searchHistory.select(option.result, resultsQuery);
											closeDropdown();
										}}
									>
										<span class="result-icon" aria-hidden="true">
											{#if option.result.kind === 'track'}<Music2 size={16} />
											{:else if option.result.kind === 'album'}<Disc3 size={16} />
											{:else if option.result.kind === 'artist'}<UserRound size={16} />
											{:else}<ListMusic size={16} />{/if}
										</span>
										<span class="result-copy">
											<strong>{titleFor(option.result)}</strong>
											<small>{subtitleFor(option.result)}</small>
										</span>
									</a>
								{/each}
							</section>
						{/if}
					{/each}
				{/if}
			</div>
			{#if !resourceHref && !isSearching}
				<a
					class="view-all"
					href={`${resolve('/app/search')}?q=${encodeURIComponent(query.trim())}`}
					onclick={closeDropdown}>{m.search_header_view_all({ query: query.trim() })}</a
				>
			{/if}
		</div>
	{/if}
</div>

<style>
	.header-search {
		position: relative;
		width: 100%;
		max-width: 34rem;
	}
	.search-dropdown {
		position: absolute;
		z-index: 60;
		top: calc(100% + 0.55rem);
		width: 100%;
		max-height: min(60dvh, 34rem);
		overscroll-behavior: contain;
		overflow-y: auto;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: 0 18px 34px -24px rgb(0 0 0 / 72%);
	}
	.result-group {
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	.group-label {
		margin: 0;
		padding: 0.45rem 0.55rem;
		color: var(--editorial-faint);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.dropdown-result,
	.resource-result {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.75rem;
		min-height: 3rem;
		padding: 0.6rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-primary);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.dropdown-result:hover,
	.dropdown-result.active,
	.resource-result:hover,
	.resource-result.active,
	.view-all:hover {
		background: color-mix(in oklab, var(--editorial-sky) 62%, var(--surface-raised));
	}
	.dropdown-result:focus-visible,
	.resource-result:focus-visible,
	.view-all:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	.result-icon {
		display: grid;
		flex: none;
		width: 2.1rem;
		height: 2.1rem;
		place-items: center;
		border-radius: var(--radius-sm);
		background: color-mix(in oklab, var(--editorial-sky) 58%, var(--surface-raised));
		color: var(--action);
	}
	.result-copy {
		display: grid;
		min-width: 0;
		gap: 0.1rem;
	}
	.result-copy strong,
	.result-copy small,
	.resource-result small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.result-copy small,
	.resource-result small {
		color: var(--text-muted);
		font-size: 0.75rem;
	}
	.resource-result span {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.dropdown-state {
		margin: 0;
		padding: 0.9rem 1rem;
		color: var(--text-muted);
		font-size: 0.875rem;
	}
	.view-all {
		display: block;
		padding: 0.75rem 1rem;
		color: var(--action);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		text-decoration: none;
	}
	@media (max-width: 42rem) {
		.header-search {
			max-width: none;
		}
		.search-dropdown {
			position: absolute;
			right: 0;
			left: 0;
			width: auto;
		}
	}
</style>
