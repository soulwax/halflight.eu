<script lang="ts">
	import { resolve } from '$app/paths';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import type { TrackSummary } from '#lib/server/tidal/models';

	let { data }: { data: PageData } = $props();

	const sectionLabel: Record<string, () => string> = {
		albums: m.search_albums,
		artists: m.search_artists,
		tracks: m.search_tracks,
		playlists: m.search_playlists
	};

	const mark: Record<string, string> = {
		albums: '▣',
		artists: '●',
		tracks: '■',
		playlists: '≡'
	};

	type Item = {
		kind: string;
		id: string;
		title?: string;
		name?: string;
		artists?: { name: string }[];
	};

	function titleOf(item: Item): string {
		return item.title ?? item.name ?? '';
	}

	function subtitleOf(item: Item): string {
		return item.artists?.map((artist) => artist.name).join(', ') ?? '';
	}
</script>

<svelte:head>
	<title>{m.library_title()} — Syn</title>
	<meta name="description" content={m.library_subtitle()} />
</svelte:head>

<section class="library" aria-labelledby="library-title">
	<header class="library-header">
		<p class="eyebrow">SYN // PERSONAL CATALOGUE</p>
		<h1 id="library-title">{m.library_title()}</h1>
		<p class="intro">{m.library_subtitle()}</p>
	</header>

	{#if !data.connected}
		<section class="state-card" aria-labelledby="connect-title">
			<h2 id="connect-title">{m.search_not_connected_title()}</h2>
			<p>{m.search_not_connected_description()}</p>
			<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
		</section>
	{:else if data.sections}
		{#each data.sections as section (section.kind)}
			<section class="result-group" aria-labelledby="{section.kind}-title">
				<div class="group-header">
					<span class="geo-mark geo-{section.kind}"></span>
					<h2 id="{section.kind}-title">
						{sectionLabel[section.kind]()}
						{#if section.ok && section.hasMore}<span class="more">· {m.library_has_more()}</span
							>{/if}
					</h2>
					{#if section.ok && section.items}
						<span class="group-count">({section.items.length})</span>
					{/if}
				</div>

				{#if !section.ok}
					<p class="group-empty" role="alert">{m.library_section_error()}</p>
				{:else if section.items.length === 0}
					<p class="group-empty">{m.library_section_empty()}</p>
				{:else if section.kind === 'tracks'}
					<div class="song-cards-grid">
						{#each section.items as track, index (track.id)}
							<SongCard
								track={track as TrackSummary}
								contextTracks={section.items as TrackSummary[]}
								{index}
							/>
						{/each}
					</div>
				{:else}
					<ul class="result-list">
						{#each section.items as item (item.id)}
							<li class="result-row">
								<div
									class="media-mark"
									class:circle-mark={section.kind === 'artists'}
									aria-hidden="true"
								>
									{mark[section.kind]}
								</div>
								{#if item.kind === 'album'}
									<a class="item-link" href={resolve('/app/albums/[id]', { id: item.id })}>
										<strong>{titleOf(item)}</strong>
										{#if subtitleOf(item)}<span class="item-subtitle">{subtitleOf(item)}</span>{/if}
									</a>
								{:else if item.kind === 'artist'}
									<a class="item-link" href={resolve('/app/artists/[id]', { id: item.id })}>
										<strong>{titleOf(item)}</strong>
									</a>
								{:else if item.kind === 'playlist'}
									<a class="item-link" href={resolve('/app/playlists/[id]', { id: item.id })}>
										<strong>{titleOf(item)}</strong>
									</a>
								{:else}
									<div class="item-link">
										<strong>{titleOf(item)}</strong>
										{#if subtitleOf(item)}<span class="item-subtitle">{subtitleOf(item)}</span>{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.library {
		max-width: 64rem;
	}

	.library-header {
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

	.state-card,
	.result-group {
		margin-top: 1.5rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: clamp(1.25rem, 3vw, 1.75rem);
	}

	.state-card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.75rem;
	}

	.group-header h2 {
		margin: 0;
		font-size: 1.2rem;
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
	}

	.geo-tracks {
		background: var(--bauhaus-blue);
	}

	.geo-albums {
		background: var(--bauhaus-yellow);
		transform: rotate(45deg);
	}

	.geo-artists {
		background: var(--bauhaus-red);
		border-radius: 50%;
	}

	.geo-playlists {
		background: var(--text-primary);
	}

	.more {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: none;
	}

	.group-empty {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-style: italic;
	}

	.state-card p {
		margin: 0;
		color: var(--text-muted);
	}

	.state-card a {
		display: inline-flex;
		margin-top: 1rem;
		padding: 0.6rem 1.2rem;
		background: var(--action);
		color: var(--action-contrast);
		border: 1px solid var(--border-strong);
		font-weight: 700;
		text-transform: uppercase;
		text-decoration: none;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 0.75rem;
	}

	.result-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.result-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		margin-bottom: 0.5rem;
		transition: all 0.12s ease;
	}

	.result-row:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.media-mark {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		flex: 0 0 auto;
		border: 1px solid var(--border-strong);
		background: var(--surface-selected);
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-weight: 800;
	}

	.circle-mark {
		border-radius: 50%;
	}

	.item-link {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 0.15rem;
		color: inherit;
		text-decoration: none;
	}

	.item-link strong {
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	a.item-link:hover strong {
		color: var(--action);
		text-decoration: underline;
	}

	.item-subtitle {
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
</style>
