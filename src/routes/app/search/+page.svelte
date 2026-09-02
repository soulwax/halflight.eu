<script lang="ts">
	import { resolve } from '$app/paths';
	import { Loader2, Search } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { m } from '#lib/paraglide/messages';
	import type { PageData } from './$types';
	import type { SearchResultGroups } from '#lib/server/tidal/models';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let liveResults = $state<SearchResultGroups | null>(null);
	let isSearching = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		searchQuery = data.query;
		liveResults = data.results;
	});

	const currentResults = $derived(liveResults ?? data.results);
	const activeQuery = $derived(searchQuery.trim());

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

		clearTimeout(debounceTimer);
		if (!query.trim()) {
			liveResults = { tracks: [], albums: [], artists: [], playlists: [] };
			isSearching = false;
			return;
		}

		isSearching = true;
		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
				if (res.ok) {
					const body = await res.json();
					if (body.results) {
						liveResults = body.results;
					}
				}
			} catch {
				// retain existing results on network failure
			} finally {
				isSearching = false;
			}
		}, 280);
	}
</script>

<svelte:head>
	<title>{m.search_title()} — Syn</title>
	<meta name="description" content={m.search_subtitle()} />
</svelte:head>

<section class="search-page" aria-labelledby="search-title">
	<header class="search-header">
		<p class="eyebrow">SYN // EXPLORATION</p>
		<h1 id="search-title">{m.search_title()}</h1>
		<p class="intro">{m.search_subtitle()}</p>
	</header>

	<form
		class="search-form"
		method="GET"
		role="search"
		onsubmit={(e) => isSearching && e.preventDefault()}
	>
		<label for="search-query">{m.search_label()}</label>
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
					<Loader2 class="animate-spin text-[var(--action)]" size={20} />
				</div>
			{:else}
				<button type="submit" class="search-submit-btn">{m.search_button()}</button>
			{/if}
		</div>
	</form>

	{#if !data.connected}
		<section class="state-card" aria-labelledby="connect-title">
			<h2 id="connect-title">{m.search_not_connected_title()}</h2>
			<p>{m.search_not_connected_description()}</p>
			<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
		</section>
	{:else if data.error === 'invalid_query'}
		<p class="state-error" role="alert">{m.search_invalid_query()}</p>
	{:else if data.error === 'unavailable'}
		<p class="state-error" role="alert">{m.search_error()}</p>
	{:else if !activeQuery}
		<section class="state-card" aria-labelledby="empty-title">
			<h2 id="empty-title">{m.search_empty_title()}</h2>
			<p>{m.search_empty_description()}</p>
		</section>
	{:else if resultCount === 0 && !isSearching}
		<section class="state-card" aria-labelledby="no-results-title">
			<h2 id="no-results-title">{m.search_no_results_title({ query: activeQuery })}</h2>
			<p>{m.search_no_results_description()}</p>
		</section>
	{:else if currentResults}
		<div class="result-summary" role="status">
			<span class="query-tag">QUERY // {activeQuery.toUpperCase()}</span>
			<span class="count-tag">[{resultCount} RESULTS]</span>
		</div>

		{#if currentResults.tracks.length}
			<section class="result-group" aria-labelledby="tracks-title">
				<div class="group-header">
					<span class="geo-mark geo-square"></span>
					<h2 id="tracks-title">{m.search_tracks()}</h2>
					<span class="group-count">({currentResults.tracks.length})</span>
				</div>
				<div class="song-cards-grid">
					{#each currentResults.tracks as track, index (track.id)}
						<SongCard {track} contextTracks={currentResults?.tracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if currentResults.albums.length}
			<section class="result-group" aria-labelledby="albums-title">
				<div class="group-header">
					<span class="geo-mark geo-diamond"></span>
					<h2 id="albums-title">{m.search_albums()}</h2>
					<span class="group-count">({currentResults.albums.length})</span>
				</div>
				<ul class="result-list">
					{#each currentResults.albums as album (album.id)}
						<li class="result-row">
							<div class="media-mark" aria-hidden="true">▣</div>
							<a class="track-link" href={resolve('/app/albums/[id]', { id: album.id })}>
								<strong>{album.title}</strong>
								{#if album.artists.length}
									<span class="artist-subtitle"
										>{album.artists.map((artist) => artist.name).join(', ')}</span
									>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if currentResults.artists.length}
			<section class="result-group" aria-labelledby="artists-title">
				<div class="group-header">
					<span class="geo-mark geo-circle"></span>
					<h2 id="artists-title">{m.search_artists()}</h2>
					<span class="group-count">({currentResults.artists.length})</span>
				</div>
				<ul class="result-list">
					{#each currentResults.artists as artist (artist.id)}
						<li class="result-row">
							<div class="media-mark circle-mark" aria-hidden="true">●</div>
							<a class="track-link" href={resolve('/app/artists/[id]', { id: artist.id })}>
								<strong>{artist.name}</strong>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if currentResults.playlists.length}
			<section class="result-group" aria-labelledby="playlists-title">
				<div class="group-header">
					<span class="geo-mark geo-stripes"></span>
					<h2 id="playlists-title">{m.search_playlists()}</h2>
					<span class="group-count">({currentResults.playlists.length})</span>
				</div>
				<ul class="result-list">
					{#each currentResults.playlists as playlist (playlist.id)}
						<li class="result-row">
							<div class="media-mark" aria-hidden="true">≡</div>
							<a class="track-link" href={resolve('/app/playlists/[id]', { id: playlist.id })}>
								<strong>{playlist.title}</strong>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.search-page {
		max-width: 64rem;
	}

	.search-header {
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 1.5rem;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.2rem, 5vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.intro {
		margin: 0.75rem 0 0;
		color: var(--text-muted);
		font-size: 1.05rem;
	}

	.search-form {
		max-width: 48rem;
		margin-bottom: 2.5rem;
	}

	.search-form label {
		display: block;
		margin-bottom: 0.65rem;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.search-input-wrap {
		display: flex;
		align-items: stretch;
		gap: 0.65rem;
		width: 100%;
	}

	.input-container {
		display: flex;
		align-items: center;
		flex: 1;
		position: relative;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-raised);
		transition: all 0.12s ease;
	}

	.search-icon {
		position: absolute;
		left: 0.95rem;
		color: var(--text-muted);
		pointer-events: none;
	}

	input {
		width: 100%;
		border: 0;
		background: transparent;
		padding: 0.95rem 1.15rem 0.95rem 2.85rem;
		color: var(--text-primary);
		font: inherit;
		font-size: 1rem;
		font-weight: 500;
	}

	input:focus {
		outline: none;
	}

	.input-container:focus-within {
		border-color: var(--action);
		box-shadow: 3px 3px 0px var(--action);
	}

	.search-submit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		padding: 0 1.75rem;
		color: var(--action-contrast);
		font: inherit;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.search-submit-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.search-spinner {
		display: grid;
		place-items: center;
		padding: 0 1.5rem;
	}

	.state-card,
	.result-group {
		margin-top: 2rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.state-card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.state-card p {
		margin: 0;
		color: var(--text-muted);
	}

	.state-card a {
		display: inline-flex;
		margin-top: 1.25rem;
		padding: 0.65rem 1.35rem;
		background: var(--action);
		color: var(--action-contrast);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		font-weight: 700;
		text-transform: uppercase;
		text-decoration: none;
	}

	.state-error {
		margin-top: 2rem;
		border: 2px solid var(--danger);
		border-radius: var(--radius-sm, 6px);
		background: var(--danger-subtle);
		padding: 1rem 1.25rem;
		color: var(--danger);
		font-weight: 700;
	}

	.result-summary {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.query-tag {
		color: var(--action);
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.85rem;
	}

	.group-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.group-count {
		font-family: ui-monospace, monospace;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.geo-mark {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		background: var(--action);
	}

	.geo-diamond {
		background: var(--bauhaus-yellow);
		transform: rotate(45deg);
	}

	.geo-circle {
		background: var(--bauhaus-red);
		border-radius: 50%;
	}

	.geo-stripes {
		background: var(--text-primary);
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
		gap: 1.15rem;
	}

	.result-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.result-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.15rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 8px);
		background: var(--surface-canvas);
		margin-bottom: 0.65rem;
		transition: all 0.12s ease;
	}

	.result-row:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.media-mark {
		display: grid;
		place-items: center;
		width: 2.35rem;
		height: 2.35rem;
		flex: 0 0 auto;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-selected);
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-weight: 800;
	}

	.circle-mark {
		border-radius: 50%;
	}

	.track-link {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 0.15rem;
		color: inherit;
		text-decoration: none;
	}

	.track-link strong {
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-link:hover strong {
		color: var(--action);
		text-decoration: underline;
	}

	.artist-subtitle {
		color: var(--text-muted);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.attribution {
		margin-top: 2.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}

	@media (max-width: 36rem) {
		.search-input-wrap {
			flex-direction: column;
		}

		.search-submit-btn {
			min-height: 2.85rem;
		}
	}
</style>
