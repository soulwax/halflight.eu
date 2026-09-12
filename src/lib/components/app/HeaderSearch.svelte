<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		Disc3,
		ExternalLink,
		ListMusic,
		LoaderCircle,
		Music2,
		Search,
		UserRound
	} from '@lucide/svelte';
	import { onDestroy } from 'svelte';
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

	let root: HTMLDivElement;
	let query = $state('');
	let results = $state<SearchResultGroups | null>(null);
	let isOpen = $state(false);
	let isSearching = $state(false);
	let error = $state<'not_connected' | 'unavailable' | null>(null);
	let resourceHref = $state<string | null>(null);
	let activeIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;
	let requestVersion = 0;

	const options = $derived<DropdownOption[]>(
		results
			? (Object.entries(RESULT_LIMITS).flatMap(([kind, limit]) =>
					(results?.[kind as SearchKind] ?? []).slice(0, limit).map((result) => ({
						id: `${kind}-${result.id}`,
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

	function cancelSearch(): void {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = undefined;
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
		clearResults();
		cancelSearch();

		const trimmed = query.trim();
		const resource = parseTidalResource(trimmed);
		if (resource) {
			resourceHref = resource.appPath;
			return;
		}
		if (trimmed.length < MINIMUM_QUERY_LENGTH) return;

		const version = requestVersion;
		isSearching = true;
		debounceTimer = setTimeout(() => void fetchResults(trimmed, version), 250);
	}

	async function fetchResults(searchQuery: string, version: number): Promise<void> {
		if (version !== requestVersion) return;
		const nextController = new AbortController();
		controller = nextController;
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
				signal: nextController.signal
			});
			if (version !== requestVersion || nextController.signal.aborted) return;
			if (!response.ok) {
				error = response.status === 503 ? 'not_connected' : 'unavailable';
				return;
			}
			const body = (await response.json()) as { results?: SearchResultGroups };
			if (version === requestVersion && !nextController.signal.aborted) {
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
		closeDropdown();
		void goto(href);
	}

	function submitSearch(): void {
		const trimmed = query.trim();
		if (!trimmed) return;
		if (resourceHref) {
			navigate(resourceHref);
			return;
		}
		navigate(`${resolve('/app/search')}?q=${encodeURIComponent(trimmed)}`);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			closeDropdown();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			isOpen = true;
			activeIndex = Math.min(activeIndex + 1, options.length - 1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
			return;
		}
		if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
			event.preventDefault();
			navigate(options[activeIndex].href);
		}
	}

	function handleFocusOut(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !root.contains(next)) closeDropdown();
	}
</script>

<div class="header-search" bind:this={root} onfocusout={handleFocusOut}>
	<form
		role="search"
		action={resolve('/app/search')}
		onsubmit={(event) => {
			event.preventDefault();
			submitSearch();
		}}
	>
		<label class="sr-only" for="header-search-input">{m.search_header_label()}</label>
		<div class="search-field">
			<Search size={16} aria-hidden="true" />
			<input
				id="header-search-input"
				name="q"
				type="text"
				role="combobox"
				value={query}
				oninput={handleInput}
				onfocus={() => (isOpen = true)}
				onkeydown={handleKeydown}
				placeholder={m.search_header_placeholder()}
				maxlength="160"
				autocomplete="off"
				aria-autocomplete="list"
				aria-controls="header-search-results"
				aria-expanded={shouldShowDropdown}
				aria-activedescendant={activeIndex >= 0 ? options[activeIndex]?.id : undefined}
			/>
			{#if isSearching}
				<span>
					<LoaderCircle class="animate-spin" size={16} aria-label={m.search_live_searching()} />
				</span>
			{/if}
		</div>
	</form>

	{#if shouldShowDropdown}
		<div
			id="header-search-results"
			class="search-dropdown"
			role="listbox"
			aria-label={m.search_header_results()}
		>
			{#if resourceHref}
				<button type="button" class="resource-result" onclick={() => navigate(resourceHref!)}>
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
			{:else if isSearching}
				<p class="dropdown-state" role="status">{m.search_live_searching()}</p>
			{:else if options.length === 0 && query.trim().length >= MINIMUM_QUERY_LENGTH}
				<p class="dropdown-state" role="status">{m.search_header_no_results()}</p>
			{:else}
				{#each ['tracks', 'albums', 'artists', 'playlists'] as kind (kind)}
					{@const group = options.filter((option) => option.kind === kind)}
					{#if group.length}
						<section class="result-group" aria-label={kindLabel(kind as SearchKind)}>
							<p class="group-label">{kindLabel(kind as SearchKind)}</p>
							{#each group as option (option.id)}
								<a
									id={option.id}
									class:active={options.indexOf(option) === activeIndex}
									class="dropdown-result"
									href={option.href}
									role="option"
									aria-selected={options.indexOf(option) === activeIndex}
									onclick={closeDropdown}
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
				<a
					class="view-all"
					href={`${resolve('/app/search')}?q=${encodeURIComponent(query.trim())}`}
					onclick={closeDropdown}
				>
					{m.search_header_view_all({ query: query.trim() })}
				</a>
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
	.search-field {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		height: 2.5rem;
		padding: 0 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		color: var(--editorial-faint);
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			color 140ms ease;
	}
	.search-field:focus-within {
		border-color: color-mix(in oklab, var(--action) 64%, var(--border-subtle));
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--editorial-sky) 58%, transparent);
		color: var(--action);
	}
	input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.875rem;
		letter-spacing: -0.005em;
		outline: none;
	}
	input::placeholder {
		color: var(--text-muted);
	}
	.search-dropdown {
		position: absolute;
		z-index: 60;
		top: calc(100% + 0.55rem);
		width: 100%;
		max-height: min(70dvh, 34rem);
		overflow-y: auto;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: 0 18px 34px -24px rgb(6 48 100 / 38%);
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 42rem) {
		.header-search {
			max-width: none;
		}
		.search-field {
			height: 2.25rem;
		}
		input {
			font-size: 0.8rem;
		}
		.search-dropdown {
			position: fixed;
			right: 0.75rem;
			left: 0.75rem;
			width: auto;
		}
	}
</style>
