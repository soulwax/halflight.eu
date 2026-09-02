<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const resultCount = $derived(
		data.results
			? data.results.tracks.length +
					data.results.albums.length +
					data.results.artists.length +
					data.results.playlists.length
			: 0
	);
</script>

<svelte:head>
	<title>{m.search_title()} — Syn</title>
	<meta name="description" content={m.search_subtitle()} />
</svelte:head>

<section class="search-page" aria-labelledby="search-title">
	<header>
		<p class="eyebrow">TIDAL</p>
		<h1 id="search-title">{m.search_title()}</h1>
		<p class="intro">{m.search_subtitle()}</p>
	</header>

	<form class="search-form" method="GET" role="search">
		<label for="search-query">{m.search_label()}</label>
		<div>
			<input
				id="search-query"
				name="q"
				type="search"
				value={data.query}
				placeholder={m.search_placeholder()}
				maxlength="160"
				autocomplete="off"
			/>
			<button type="submit">{m.search_button()}</button>
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
	{:else if !data.query}
		<section class="state-card" aria-labelledby="empty-title">
			<h2 id="empty-title">{m.search_empty_title()}</h2>
			<p>{m.search_empty_description()}</p>
		</section>
	{:else if resultCount === 0}
		<section class="state-card" aria-labelledby="no-results-title">
			<h2 id="no-results-title">{m.search_no_results_title({ query: data.query })}</h2>
			<p>{m.search_no_results_description()}</p>
		</section>
	{:else if data.results}
		<div class="result-summary" role="status">
			{m.search_results_for({ query: data.query })} · {resultCount}
		</div>

		{#if data.results.tracks.length}
			<section class="result-group" aria-labelledby="tracks-title">
				<h2 id="tracks-title">{m.search_tracks()}</h2>
				<ul>
					{#each data.results.tracks as track (track.id)}
						<li>
							<div class="media-mark" aria-hidden="true">♪</div>
							<a class="track-link" href={resolve('/app/tracks/[id]', { id: track.id })}>
								<strong>{track.title}</strong>
								{#if track.artists.length}
									<span>{track.artists.map((artist) => artist.name).join(', ')}</span>
								{/if}
								{#if track.album}<small>{track.album.title}</small>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.results.albums.length}
			<section class="result-group" aria-labelledby="albums-title">
				<h2 id="albums-title">{m.search_albums()}</h2>
				<ul>
					{#each data.results.albums as album (album.id)}
						<li>
							<div class="media-mark" aria-hidden="true">▣</div>
							<div>
								<strong>{album.title}</strong>
								{#if album.artists.length}
									<span>{album.artists.map((artist) => artist.name).join(', ')}</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.results.artists.length}
			<section class="result-group" aria-labelledby="artists-title">
				<h2 id="artists-title">{m.search_artists()}</h2>
				<ul>
					{#each data.results.artists as artist (artist.id)}
						<li>
							<div class="media-mark" aria-hidden="true">●</div>
							<strong>{artist.name}</strong>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.results.playlists.length}
			<section class="result-group" aria-labelledby="playlists-title">
				<h2 id="playlists-title">{m.search_playlists()}</h2>
				<ul>
					{#each data.results.playlists as playlist (playlist.id)}
						<li>
							<div class="media-mark" aria-hidden="true">≡</div>
							<strong>{playlist.title}</strong>
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

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.intro {
		margin: 0.75rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.search-form {
		max-width: 42rem;
	}

	.search-form label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.search-form div {
		display: flex;
		gap: 0.5rem;
	}

	input {
		min-width: 0;
		flex: 1;
		border: 1px solid var(--border-strong);
		border-radius: 0.75rem;
		background: var(--surface-raised);
		padding: 0.75rem 0.9rem;
		color: var(--text-primary);
	}

	button,
	.state-card a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}

	.state-card,
	.result-group {
		margin-top: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.state-card h2,
	.result-group h2 {
		margin-bottom: 0.5rem;
		font-size: 1.15rem;
	}

	.state-card p,
	.result-group span,
	.result-group small {
		color: var(--text-muted);
	}

	.state-card a {
		margin-top: 0.5rem;
	}

	.state-error {
		margin-top: 1.5rem;
		border-radius: 0.75rem;
		background: var(--danger-subtle);
		padding: 0.75rem;
		color: var(--danger);
	}

	.result-summary {
		margin-top: 2rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.result-group {
		margin-top: 1rem;
	}

	.result-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.result-group li {
		display: flex;
		min-height: 3.5rem;
		align-items: center;
		gap: 0.75rem;
		border-top: 1px solid var(--border-subtle);
		padding: 0.7rem 0;
	}

	.result-group li:first-child {
		border-top: 0;
	}

	.result-group li > div:last-child {
		display: grid;
		gap: 0.15rem;
	}

	.track-link {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
		color: inherit;
		text-decoration: none;
	}

	.track-link:hover strong,
	.track-link:focus-visible strong {
		text-decoration: underline;
	}

	.media-mark {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.65rem;
		background: var(--surface-selected);
		color: var(--text-primary);
		font-weight: 700;
	}

	.attribution {
		margin-top: 2rem;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.attribution a {
		color: inherit;
	}

	@media (max-width: 31rem) {
		.search-form div {
			flex-direction: column;
		}
	}
</style>
