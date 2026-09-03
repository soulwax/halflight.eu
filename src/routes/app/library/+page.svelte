<script lang="ts">
	import { Download, ListMusic, Play, Sparkles, Trash2 } from '@lucide/svelte';

	import SongCard from '#lib/components/music/SongCard.svelte';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import MediaCard from '#lib/components/music/MediaCard.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import type { PageData } from './$types';
	import type { TrackSummary } from '#lib/tidal/models';

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
</script>

<svelte:head>
	<title>{m.library_title()} — Syn</title>
	<meta name="description" content={m.library_subtitle()} />
</svelte:head>

<section class="library" aria-labelledby="library-title">
	<header class="library-header">
		<p class="deco-eyebrow">SYN // PERSONAL CATALOGUE</p>
		<h1 id="library-title" class="library-title">{m.library_title()}</h1>
		<p class="intro">{m.library_subtitle()}</p>
	</header>

	<!-- Custom Playlists Section -->
	<section class="custom-pl-block" aria-labelledby="user-playlists-title">
		<SectionHeader
			title="MY CUSTOM PLAYLISTS"
			titleId="user-playlists-title"
			count={customPlaylists.playlists.length}
		>
			{#snippet actions()}
				<Button variant="primary" onclick={() => customPlaylists.openGenerator()}>
					<Sparkles size={14} />
					COMPOSE ON THE FLY
				</Button>
			{/snippet}
		</SectionHeader>

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
								title={m.action_export_m3u8()}
								onclick={() => downloadPlaylist(playlist.id, 'm3u8')}
							>
								<Download size={12} />
								M3U8
							</button>
							<button
								type="button"
								class="card-del-btn"
								onclick={() => customPlaylists.deletePlaylist(playlist.id)}
								title={m.action_delete()}
								aria-label={m.action_delete_playlist()}
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
		<StateCard
			state="not_connected"
			title={m.search_not_connected_title()}
			description={m.search_not_connected_description()}
		/>
	{:else if data.sections}
		{#each data.sections as section (section.kind)}
			<section class="result-group" aria-labelledby="{section.kind}-title">
				<SectionHeader
					title={sectionLabel[section.kind]()}
					titleId="{section.kind}-title"
					count={section.ok && section.items ? section.items.length : undefined}
					subtitle={section.ok && section.hasMore ? m.library_has_more() : undefined}
				/>

				{#if !section.ok}
					<p class="group-empty" role="alert">{m.library_section_error()}</p>
				{:else if section.items.length === 0}
					<p class="group-empty">{m.library_section_empty()}</p>
				{:else if section.kind === 'tracks'}
					<div class="song-cards-grid">
						{#each section.items as track, index (track.id)}
							<SongCard
								track={track as unknown as TrackSummary}
								contextTracks={section.items as unknown as TrackSummary[]}
								{index}
							/>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each section.items as item (item.id)}
							<MediaCard
								{item}
								kind={section.kind === 'albums'
									? 'album'
									: section.kind === 'artists'
										? 'artist'
										: 'playlist'}
							/>
						{/each}
					</div>
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
		max-width: 72rem;
	}

	.library-header {
		margin-bottom: 2.25rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 1.5rem;
	}

	.library-title {
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

	.custom-pl-block {
		margin-bottom: 3rem;
		padding: 1.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-raised);
	}

	.custom-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.custom-card {
		padding: 1rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.85rem;
		transition: all 0.12s ease;
	}

	.custom-card:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
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
		gap: 0.4rem;
		border-top: 1px dashed var(--border-subtle);
		padding-top: 0.65rem;
	}

	.card-play-btn,
	.card-export-btn,
	.card-del-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		font-size: 0.72rem;
		font-weight: 700;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.card-play-btn {
		background: var(--action);
		color: var(--action-contrast);
		border-color: var(--action);
	}

	.card-play-btn:hover:not(:disabled) {
		background: var(--accent-gold-deep);
		transform: scale(1.03);
	}

	.card-export-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.card-del-btn {
		padding: 0.35rem 0.45rem;
		color: var(--text-muted);
		margin-left: auto;
	}

	.card-del-btn:hover {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-subtle);
	}

	.result-group {
		margin-top: 3rem;
	}

	.group-empty {
		padding: 1.5rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		font-size: 0.88rem;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.15rem;
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
