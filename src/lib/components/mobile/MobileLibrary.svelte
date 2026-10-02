<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { localizeHref } from '#lib/paraglide/runtime';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { Disc, ListPlus, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import PrivateMusicShelf from '#lib/components/music/PrivateMusicShelf.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import type { MobileLibraryData } from '#lib/tidal/mobile-library';
	import type { TrackSummary } from '#lib/tidal/models';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import MobileScreenHeader from './MobileScreenHeader.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

	let { data }: { data: MobileLibraryData } = $props();
	let confirmationOpen = $state(false);
	let refreshing = $state(false);
	let searching = $state(false);
	let pending = $state<{ title: string; tracks: TrackSummary[]; start: TrackSummary } | null>(null);
	let feedback = $state('');
	let failedArtwork = $state<Record<string, boolean>>({});
	const libraryHref = resolve('/(mobile)/library');

	function play(title: string, tracks: TrackSummary[], start = tracks[0]): void {
		if (!tracks.length) return;
		feedback = '';
		if (player.currentTrack || player.queueCount) {
			pending = { title, tracks, start };
			confirmationOpen = true;
		} else {
			player.play(start, tracks, title);
		}
	}

	function confirmPlay(): void {
		if (!pending) return;
		player.play(pending.start, pending.tracks, pending.title);
		confirmationOpen = false;
		pending = null;
	}

	function enqueue(title: string, tracks: TrackSummary[]): void {
		player.addMultipleToQueue(tracks, title);
		feedback = m.now_library_added({ title });
	}
	async function retryLibrary(): Promise<void> {
		if (refreshing) return;
		refreshing = true;
		feedback = '';
		try {
			await invalidateAll();
		} catch {
			feedback = m.now_library_unavailable();
		} finally {
			refreshing = false;
		}
	}
	async function searchLibrary(
		event: SubmitEvent & { currentTarget: HTMLFormElement }
	): Promise<void> {
		event.preventDefault();
		if (searching) return;
		const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
		searching = true;
		feedback = '';
		try {
			await goto(
				`${localizeHref(libraryHref)}?${new URLSearchParams({ tab: 'saved', ...(query ? { q: query } : {}) })}`,
				{ reset: false }
			);
		} catch {
			feedback = m.now_library_unavailable();
		} finally {
			searching = false;
		}
	}
</script>

{#snippet artwork(track?: TrackSummary)}
	{@const cover = trackArtworkUrl(track, 160)}
	<span class="artwork">
		{#if cover && !failedArtwork[cover]}
			<img
				src={cover}
				alt=""
				loading="lazy"
				decoding="async"
				width="64"
				height="64"
				onerror={() => cover && (failedArtwork[cover] = true)}
			/>
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
		<a
			href={`${libraryHref}?tab=private`}
			aria-current={data.tab === 'private' ? 'page' : undefined}
		>
			{m.now_library_private_music()}
		</a>
		<a href={`${libraryHref}?tab=saved`} aria-current={data.tab === 'saved' ? 'page' : undefined}>
			{m.now_library_saved()}
		</a>
		<a href={`${libraryHref}?tab=tracks`} aria-current={data.tab === 'tracks' ? 'page' : undefined}>
			{m.now_library_favorites()}
		</a>
	</nav>
	{#if data.tab === 'saved'}
		<form
			method="get"
			action={localizeHref(libraryHref)}
			class="library-search"
			role="search"
			onsubmit={searchLibrary}
		>
			<input type="hidden" name="tab" value="saved" />
			<label for="saved-library-query">{m.now_library_search_label()}</label>
			<div class="search-controls">
				<input
					id="saved-library-query"
					type="search"
					name="q"
					value={data.query ?? ''}
					maxlength="120"
					placeholder={m.now_library_search_placeholder()}
				/>
				<button type="submit" disabled={searching} aria-busy={searching}>{m.search_button()}</button
				>
			</div>
			{#if data.query}
				<a class="text-action" href={`${localizeHref(libraryHref)}?tab=saved`}
					>{m.now_library_clear_search()}</a
				>
			{/if}
		</form>
	{/if}
	{#if data.hiddenTrackCount}
		<p class="availability-note">
			{m.now_library_unplayable_skipped({ count: data.hiddenTrackCount })}
		</p>
	{/if}

	{#if data.tab === 'private' && data.status !== 'unavailable'}
		<PrivateMusicShelf library={data.privateMusic} headingId="mobile-private-music-title" />
	{:else if data.status === 'disconnected'}
		<div class="notice" role="status">
			<p>{m.search_not_connected_description()}</p>
			<a class="text-action" href={localizeHref(resolve('/(mobile)/settings'))}
				>{m.tidal_settings_title()}</a
			>
		</div>
	{:else if data.status === 'unavailable'}
		<div class="notice" role="alert">
			<p>{m.now_library_unavailable()}</p>
			<button type="button" disabled={refreshing} aria-busy={refreshing} onclick={retryLibrary}
				>{m.track_retry()}</button
			>
		</div>
	{:else if data.tab === 'saved'}
		{#if !data.playlists.length}
			<p class="notice">
				{data.query ? m.now_library_no_matches({ query: data.query }) : m.now_library_empty_saved()}
			</p>
		{:else}
			<ul class="library-list">
				{#each data.playlists as playlist (playlist.id)}
					<li class="playlist-row">
						<a class="identity" href={resolve('/(mobile)/playlists/[id]', { id: playlist.id })}>
							{@render artwork(playlist.items[0])}
							<div class="copy">
								<h2>{playlist.title}</h2>
								<p>
									{m.now_library_count({
										count: playlist.totalTrackCount ?? playlist.items.length
									})}
								</p>
								{#if (playlist.totalTrackCount ?? playlist.items.length) > playlist.items.length}
									<p>{m.now_library_available_count({ count: playlist.items.length })}</p>
								{/if}
							</div>
						</a>
						<div class="playlist-actions">
							<button
								type="button"
								disabled={!playlist.items.length}
								aria-label={m.now_library_play({ title: playlist.title })}
								onclick={() => play(playlist.title, playlist.items)}
							>
								<Play size={18} aria-hidden="true" />
							</button>
							<button
								type="button"
								disabled={!playlist.items.length}
								aria-label={m.player_add_to_queue()}
								onclick={() => enqueue(playlist.title, playlist.items)}
							>
								<ListPlus size={18} aria-hidden="true" />
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
					<MobileTrackRow
						{track}
						contextTracks={data.tracks}
						provenance={m.now_library_favorites()}
						onActivate={() => play(m.now_library_favorites(), data.tracks, track)}
					/>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.status === 'ready' && data.tab !== 'private'}
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
	{#if data.tab !== 'private'}
		<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	{/if}
</section>

<Dialog
	bind:open={confirmationOpen}
	title={m.now_library_replace({ title: pending?.title ?? '' })}
	onOpenChange={(open) => {
		if (!open) pending = null;
	}}
>
	<div class="actions confirmation-actions">
		<button
			type="button"
			onclick={() => {
				confirmationOpen = false;
				pending = null;
			}}>{m.playlist_cancel()}</button
		>
		<button type="button" onclick={confirmPlay}>{m.now_library_confirm()}</button>
	</div>
</Dialog>

<style>
	.mobile-library {
		min-width: 0;
		overflow-wrap: anywhere;
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
		padding: 0.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: color-mix(in oklab, var(--surface-raised) 78%, transparent);
	}
	.filters a {
		flex: 1 1 5rem;
		min-height: 2.5rem;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		text-align: center;
		overflow-wrap: anywhere;
	}
	.filters a[aria-current='page'] {
		background: var(--surface-selected);
		color: var(--text-primary);
		box-shadow: inset 0 0 0 1px var(--border-strong);
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
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-block: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
		flex: 1;
		color: inherit;
		text-decoration: none;
		border-radius: var(--radius-md);
	}
	.identity:hover .copy h2 {
		color: var(--action);
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
	.playlist-actions {
		display: flex;
		flex: none;
		gap: 0.125rem;
	}
	.playlist-actions button {
		width: 3rem;
		min-width: 3rem;
		height: 3rem;
		min-height: 3rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-muted);
	}
	.playlist-actions button:first-child {
		background: var(--action);
		color: var(--action-contrast);
	}
	.favorite-track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.favorite-track-list > li {
		border-bottom: 1px solid var(--border-subtle);
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
	.confirmation-actions {
		padding: 1.5rem;
	}
	.library-search {
		margin-block: 1rem;
	}
	.library-search label {
		display: block;
		margin-bottom: 0.5rem;
	}
	.search-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.search-controls input {
		min-width: 0;
		width: 100%;
		flex: 1 1 10rem;
		min-height: 3rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		padding-inline: 0.75rem;
	}
	.availability-note {
		color: var(--text-muted);
		margin-block: 1rem;
	}
	@media (max-width: 24rem) {
		.playlist-row {
			flex-wrap: wrap;
		}
		.playlist-row .identity {
			flex-basis: 100%;
		}
		.playlist-actions {
			margin-left: auto;
		}
	}
</style>
