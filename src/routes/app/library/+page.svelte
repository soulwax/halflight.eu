<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download, ListMusic, Play, Sparkles, Trash2 } from '@lucide/svelte';

	import SongCard from '#lib/components/music/SongCard.svelte';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import type { TrackSummary } from '#lib/server/tidal/models';

	let { data }: { data: PageData } = $props();

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

	<!-- Custom Playlists Section -->
	<section class="custom-pl-block" aria-labelledby="user-playlists-title">
		<div class="custom-pl-header">
			<div class="flex items-center gap-2">
				<span class="geo-mark geo-playlists"></span>
				<h2 id="user-playlists-title">MY CUSTOM PLAYLISTS</h2>
				<span class="group-count">({customPlaylists.playlists.length})</span>
			</div>
			<button type="button" class="create-btn" onclick={() => customPlaylists.openGenerator()}>
				<Sparkles size={14} />
				COMPOSE ON THE FLY
			</button>
		</div>

		{#if customPlaylists.playlists.length === 0}
			<p class="group-empty">
				No custom playlists created yet. Click "Compose On The Fly" or add tracks from any song card
				with (+).
			</p>
		{:else}
			<div class="custom-grid">
				{#each customPlaylists.playlists as playlist (playlist.id)}
					<article class="custom-card">
						<div class="card-top">
							<ListMusic size={22} class="text-[var(--action)]" />
							<div class="min-w-0 flex-1">
								<strong class="block truncate">{playlist.title}</strong>
								<span class="font-mono text-xs text-[var(--text-muted)]"
									>{playlist.items.length} tracks</span
								>
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
								PLAY
							</button>
							<button
								type="button"
								class="card-export-btn"
								disabled={playlist.items.length === 0}
								title="Download as M3U8"
								onclick={() => downloadPlaylist(playlist.id, 'm3u8')}
							>
								<Download size={12} />
								M3U8
							</button>
							<button
								type="button"
								class="card-del-btn"
								onclick={() => customPlaylists.deletePlaylist(playlist.id)}
								title="Delete"
								aria-label="Delete playlist"
							>
								<Trash2 size={13} />
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>

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
		margin-top: 3rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}

	/* Custom Playlists Block */
	.custom-pl-block {
		margin-bottom: 3.5rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.custom-pl-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.85rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.custom-pl-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.create-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.create-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.custom-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 1.15rem;
	}

	.custom-card {
		padding: 1.15rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-md, 10px);
		background: var(--surface-canvas);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: all 0.12s ease;
	}

	.custom-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
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
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.65rem;
		border-top: 1px solid var(--border-subtle);
	}

	.card-play-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.85rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.card-play-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.card-play-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.card-del-btn {
		display: grid;
		place-items: center;
		width: 1.95rem;
		height: 1.95rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.card-del-btn:hover {
		border-color: var(--danger);
		color: var(--danger);
		background: var(--danger-subtle);
	}
</style>
