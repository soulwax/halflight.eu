<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ListPlus, ListStart, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { MobileLibraryData } from '#lib/tidal/mobile-library';
	import type { TrackSummary } from '#lib/tidal/models';
	import MobileScreenHeader from './MobileScreenHeader.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

	let { data }: { data: MobileLibraryData } = $props();
	let confirmation: HTMLDialogElement;
	let pending = $state<{ title: string; tracks: TrackSummary[] } | null>(null);
	let feedback = $state('');
	const libraryHref = resolve('/(mobile)/library');

	function play(title: string, tracks: TrackSummary[]): void {
		if (!tracks.length) return;
		feedback = '';
		if (player.currentTrack || player.queueCount) {
			pending = { title, tracks };
			confirmation.showModal();
		} else {
			player.play(tracks[0], tracks, title);
		}
	}

	function confirmPlay(): void {
		if (!pending) return;
		player.play(pending.tracks[0], pending.tracks, pending.title);
		confirmation.close();
	}

	function enqueue(title: string, tracks: TrackSummary[]): void {
		for (const track of tracks) player.addToQueue(track, title);
		feedback = m.now_library_added({ title });
	}
</script>

{#snippet artwork(track?: TrackSummary)}
	{@const cover = track?.imageUrl ?? track?.album?.imageUrl}
	<span class="artwork">
		{#if cover}
			<img src={cover} alt="" loading="lazy" width="64" height="64" />
		{:else}
			<Disc size={28} aria-hidden="true" />
		{/if}
	</span>
{/snippet}

<section class="mobile-library" aria-labelledby="mobile-library-title">
	<MobileScreenHeader
		heading={m.now_tab_library()}
		lead={m.now_library_description()}
		headingId="mobile-library-title"
	/>
	<nav class="filters" aria-label={m.now_tab_library()}>
		<a href={`${libraryHref}?tab=saved`} aria-current={data.tab === 'saved' ? 'page' : undefined}>
			{m.now_library_saved()}
		</a>
		<a href={`${libraryHref}?tab=tracks`} aria-current={data.tab === 'tracks' ? 'page' : undefined}>
			{m.now_library_favorites()}
		</a>
	</nav>

	{#if data.status === 'disconnected'}
		<div class="notice" role="status">
			<p>{m.search_not_connected_description()}</p>
			<a class="text-action" href={resolve('/app/settings/tidal')}>{m.tidal_settings_title()}</a>
		</div>
	{:else if data.status === 'unavailable'}
		<div class="notice" role="alert">
			<p>{m.now_library_unavailable()}</p>
			<button type="button" onclick={() => window.location.reload()}>{m.track_retry()}</button>
		</div>
	{:else if data.tab === 'saved'}
		{#if !data.playlists.length}
			<p class="notice">{m.now_library_empty_saved()}</p>
		{:else}
			<ul class="library-list">
				{#each data.playlists as playlist (playlist.id)}
					<li>
						<div class="identity">
							{@render artwork(playlist.items[0])}
							<div class="copy">
								<h2>{playlist.title}</h2>
								<p>{m.now_library_count({ count: playlist.items.length })}</p>
							</div>
						</div>
						<div class="actions">
							<button
								type="button"
								disabled={!playlist.items.length}
								aria-label={m.now_library_play({ title: playlist.title })}
								onclick={() => play(playlist.title, playlist.items)}
							>
								<Play size={18} aria-hidden="true" />{m.player_play_all()}
							</button>
							<button
								type="button"
								disabled={!playlist.items.length}
								onclick={() => enqueue(playlist.title, playlist.items)}
							>
								<ListPlus size={18} aria-hidden="true" />{m.player_add_to_queue()}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if !data.tracks.length}
		<p class="notice">{m.now_library_empty_favorites()}</p>
	{:else}
		<ul class="favorite-track-list">
			{#each data.tracks as track (track.id)}
				<li>
					<MobileTrackRow {track} onActivate={() => play(track.title, [track])}>
						{#snippet actions()}
							<div class="favorite-track-actions">
								<button
									type="button"
									aria-label={m.now_library_play({ title: track.title })}
									onclick={() => play(track.title, [track])}
								>
									<Play size={18} aria-hidden="true" />{m.player_play_track()}
								</button>
								<button
									type="button"
									aria-label={m.player_play_next()}
									onclick={() => {
										player.playNext(track, m.now_library_favorites());
										feedback = m.now_library_next_added({ title: track.title });
									}}><ListStart size={18} aria-hidden="true" /></button
								>
								<button
									type="button"
									aria-label={m.player_add_to_queue()}
									onclick={() => enqueue(track.title, [track])}
								>
									<ListPlus size={18} aria-hidden="true" />
								</button>
							</div>
						{/snippet}
					</MobileTrackRow>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.status === 'ready'}
		<nav class="pagination" aria-label={m.now_tab_library()}>
			{#if data.previousQuery}
				<a href={`${libraryHref}?${data.previousQuery}`}>
					{data.tab === 'tracks' ? m.now_library_first() : m.now_library_previous()}
				</a>
			{/if}
			{#if data.nextQuery}
				<a href={`${libraryHref}?${data.nextQuery}`}>{m.now_library_next()}</a>
			{:else if data.hasMore}
				<a href={resolve('/app/library')}>{m.now_library_more_desktop()}</a>
			{/if}
		</nav>
	{/if}
	<p role="status" class="feedback">{feedback}</p>
	<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
</section>

<dialog
	bind:this={confirmation}
	aria-labelledby="library-confirm-title"
	onclose={() => (pending = null)}
>
	<h2 id="library-confirm-title">{m.now_library_replace({ title: pending?.title ?? '' })}</h2>
	<div class="actions">
		<button type="button" onclick={() => confirmation.close()}>{m.playlist_cancel()}</button>
		<button type="button" onclick={confirmPlay}>{m.now_library_confirm()}</button>
	</div>
</dialog>

<style>
	.mobile-library {
		max-width: 44rem;
		margin-inline: auto;
		padding: clamp(1.5rem, 6vw, 2.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}
	h2,
	p {
		margin: 0;
	}
	.copy p,
	.notice,
	.attribution {
		color: var(--text-muted);
	}
	.filters,
	.actions,
	.pagination {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.filters {
		margin-block: 0 0.5rem;
	}
	.filters a {
		flex: 1;
		text-align: center;
	}
	button,
	.filters a,
	.pagination a,
	.text-action {
		display: inline-flex;
		min-height: 3rem;
		min-width: 3rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 0.5rem 0.75rem;
		background: var(--surface-raised);
		color: var(--text-primary);
		font: inherit;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	a[aria-current='page'] {
		border-color: var(--action);
		color: var(--action);
	}
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
	.library-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.library-list > li {
		display: grid;
		gap: 0.75rem;
		padding-block: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}
	.artwork {
		display: grid;
		place-items: center;
		flex: none;
		width: 4rem;
		height: 4rem;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-selected);
		color: var(--text-muted);
	}
	.artwork img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		min-width: 0;
	}
	.copy h2 {
		font-size: 1rem;
		overflow-wrap: anywhere;
	}
	.copy p {
		margin-top: 0.25rem;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
	.actions button {
		flex: 1;
	}
	.favorite-track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.favorite-track-list > li {
		border-bottom: 1px solid var(--border-subtle);
	}
	.favorite-track-actions {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}
	.favorite-track-actions button {
		display: grid;
		width: 2.75rem;
		min-width: 2.75rem;
		height: 2.75rem;
		min-height: 2.75rem;
		padding: 0;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--text-muted);
	}
	.favorite-track-actions button:first-child {
		width: 3rem;
	}
	.favorite-track-actions button:active,
	.favorite-track-actions button:focus-visible {
		background: var(--surface-selected);
		color: var(--action);
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.notice {
		padding-block: 2rem;
	}
	.notice p {
		margin-bottom: 1rem;
	}
	.pagination {
		margin-top: 1rem;
	}
	.feedback {
		color: var(--action);
		margin-block: 1rem;
		overflow-wrap: anywhere;
	}
	.attribution {
		font-size: 0.75rem;
	}
	dialog {
		margin: auto;
		width: min(28rem, calc(100% - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		padding: 1.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		color: var(--text-primary);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 65%);
	}
	dialog h2 {
		font-size: 1.1rem;
		overflow-wrap: anywhere;
		margin-bottom: 1.5rem;
	}
</style>
