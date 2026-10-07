<script lang="ts">
	import { resolve } from '$app/paths';
	import { ListPlus, Play, Shuffle } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import PlaylistCover from '#lib/components/music/PlaylistCover.svelte';
	import PlaylistEditor from '#lib/components/music/PlaylistEditor.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import type { PlaylistDetail, TrackSummary } from '#lib/tidal/models';
	import type { TidalPageState } from '#lib/tidal/page-state';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
	import MobileDetailRetry from './MobileDetailRetry.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

	let {
		playlist,
		state,
		isLocal = false,
		editVersion,
		editTracks
	}: {
		playlist: PlaylistDetail | null;
		state: TidalPageState | null;
		isLocal?: boolean;
		editVersion?: string;
		editTracks?: TrackSummary[];
	} = $props();

	const homeHref = resolve('/(mobile)/home');
	const settingsHref = resolve('/(mobile)/settings');

	const items = $derived(playlist?.items ?? []);
	const creatorLine = $derived(playlist?.creator?.name ?? '');
	const provenance = $derived(playlist?.title ?? undefined);
	const totalMinutes = $derived(
		Math.round(items.reduce((sum, track) => sum + (track.duration ?? 0), 0) / 60)
	);

	function playAll(): void {
		if (!items.length) return;
		player.play(items[0], items, provenance);
	}

	function shuffleAll(): void {
		if (!items.length) return;
		player.shuffle = true;
		const index = Math.floor(Math.random() * items.length);
		player.play(items[index], items, provenance, index);
	}

	function queueAll(): void {
		player.addMultipleToQueue(items, provenance);
	}
</script>

{#if playlist}
	<section class="playlist-detail" aria-labelledby="playlist-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			contextualBack
			backLabel={m.now_detail_back()}
			heading={playlist.title}
			subtitle={creatorLine}
			headingId="playlist-detail-title"
		/>

		<div class="playlist-hero">
			<span class="playlist-art">
				<PlaylistCover tracks={items} size={640} />
			</span>
			<p class="playlist-meta">
				<span>{m.now_library_count({ count: items.length })}</span>
				{#if totalMinutes > 0}<span>{totalMinutes} min</span>{/if}
			</p>
			{#if playlist.description}
				<p class="playlist-description">{playlist.description}</p>
			{/if}
		</div>

		{#if isLocal && editVersion}<div class="edit-controls">
				<PlaylistEditor
					mobile
					id={playlist.id}
					title={playlist.title}
					description={playlist.description}
					tracks={editTracks ?? items}
					version={editVersion}
				/><a
					class="notice-action"
					href={`/api/playlists/${encodeURIComponent(playlist.id)}/export?format=m3u8`}
					download>{m.action_export_m3u8()}</a
				>
			</div>{/if}

		{#if items.length}
			<div class="playlist-actions">
				<button type="button" class="primary" onclick={playAll}>
					<Play size={18} fill="currentColor" aria-hidden="true" />
					{m.player_play_all()}
				</button>
				<button type="button" onclick={shuffleAll} aria-label={m.now_playlist_shuffle()}>
					<Shuffle size={18} aria-hidden="true" />
				</button>
				<button type="button" onclick={queueAll} aria-label={m.player_add_to_queue()}>
					<ListPlus size={18} aria-hidden="true" />
				</button>
			</div>

			<ul class="playlist-tracks">
				{#each items as track, index (`${track.id}:${index}`)}
					<li>
						<MobileTrackRow
							{track}
							contextTracks={items}
							contextIndex={index}
							{provenance}
							onActivate={() => player.play(track, items, provenance, index)}
						/>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="notice">{m.now_playlist_empty()}</p>
		{/if}

		<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</section>
{:else}
	<section class="playlist-detail" aria-labelledby="playlist-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			contextualBack
			backLabel={m.now_detail_back()}
			heading={m.now_tab_library()}
			headingId="playlist-detail-title"
		/>
		{#if state === 'not_connected' || state === 'authorization_expired'}
			<div class="notice" role="status">
				<p>{m.now_playlist_disconnected()}</p>
				<a class="notice-action" href={settingsHref}>{m.tidal_connect()}</a>
			</div>
		{:else if state === 'not_found' || state === 'invalid_id'}
			<div class="notice" role="status">
				<p>{m.now_playlist_not_found()}</p>
				<a class="notice-action" href={homeHref}>{m.now_idle_cta()}</a>
			</div>
		{:else}
			<div class="notice" role="alert">
				<p>{m.now_playlist_unavailable()}</p>
				<MobileDetailRetry />
			</div>
		{/if}
	</section>
{/if}

<style>
	.playlist-detail {
		max-width: 44rem;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}

	.playlist-hero {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		text-align: center;
	}

	.playlist-art {
		display: grid;
		place-items: center;
		width: min(64vw, 17rem);
		aspect-ratio: 1;
		overflow: hidden;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-selected);
		box-shadow: 0 24px 42px -26px rgb(0 0 0 / 70%);
	}

	.edit-controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.playlist-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}

	.playlist-meta span + span::before {
		margin-right: 0.5rem;
		content: '·';
	}

	.playlist-description {
		max-width: 32ch;
		margin: 0;
		overflow: hidden;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.45;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.playlist-actions {
		display: flex;
		gap: 0.5rem;
		margin: clamp(1.25rem, 5vw, 1.75rem) 0 0.5rem;
	}

	.playlist-actions button {
		display: inline-flex;
		min-height: 3rem;
		min-width: 3rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.playlist-actions .primary {
		flex: 1;
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.playlist-actions button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.playlist-tracks {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.notice {
		margin-top: clamp(1.5rem, 6vw, 2.5rem);
		color: var(--text-muted);
	}

	.notice p {
		margin: 0 0 1rem;
	}

	.notice-action {
		display: inline-flex;
		min-height: 3rem;
		align-items: center;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--action);
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}

	.attribution {
		display: inline-block;
		margin-top: clamp(1.5rem, 6vw, 2.5rem);
		color: var(--text-muted);
		font-size: var(--fs-xs);
	}
</style>
