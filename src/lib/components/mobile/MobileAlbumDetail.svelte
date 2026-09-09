<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, ListPlus, ListStart, Play, Shuffle } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatReleaseDate } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	import type { AlbumDetail } from '#lib/tidal/models';
	import type { TidalPageState } from '#lib/tidal/page-state';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
	import MobileTrackRow from './MobileTrackRow.svelte';

	let { album, state }: { album: AlbumDetail | null; state: TidalPageState | null } = $props();

	const homeHref = resolve('/(mobile)/home');
	const settingsHref = resolve('/(mobile)/settings');

	const items = $derived(album?.items ?? []);
	const artistLine = $derived(album ? album.artists.map((artist) => artist.name).join(', ') : '');
	const releaseYear = $derived(album?.releaseDate ? formatReleaseDate(album.releaseDate) : '');
	const provenance = $derived(album ? `${m.album_label()} · ${album.title}` : undefined);
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
		player.play(items[Math.floor(Math.random() * items.length)], items, provenance);
	}

	function queueAll(): void {
		for (const track of items) player.addToQueue(track, provenance);
	}
</script>

{#if album}
	<section class="album-detail" aria-labelledby="album-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			backLabel={m.now_detail_back()}
			heading={album.title}
			subtitle={artistLine}
			headingId="album-detail-title"
		/>

		<div class="album-hero">
			<span class="album-art">
				{#if album.imageUrl}
					<img src={album.imageUrl} alt="" width="320" height="320" />
				{:else}
					<Disc size={56} strokeWidth={1.4} aria-hidden="true" />
				{/if}
			</span>
			<p class="album-meta">
				{#if releaseYear}<span>{releaseYear}</span>{/if}
				<span>{m.now_library_count({ count: items.length })}</span>
				{#if totalMinutes > 0}<span>{totalMinutes} min</span>{/if}
			</p>
		</div>

		{#if items.length}
			<div class="album-actions">
				<button type="button" class="primary" onclick={playAll}>
					<Play size={18} fill="currentColor" aria-hidden="true" />
					{m.player_play_all()}
				</button>
				<button type="button" onclick={shuffleAll} aria-label={m.now_album_shuffle()}>
					<Shuffle size={18} aria-hidden="true" />
				</button>
				<button type="button" onclick={queueAll} aria-label={m.player_add_to_queue()}>
					<ListPlus size={18} aria-hidden="true" />
				</button>
			</div>

			<ul class="album-tracks">
				{#each items as track (track.id)}
					<li>
						<MobileTrackRow {track} onActivate={() => player.play(track, items, provenance)}>
							{#snippet actions()}
								<button
									type="button"
									class="row-action"
									onclick={() => player.playNext(track, provenance)}
									aria-label={m.player_play_next()}
								>
									<ListStart size={16} aria-hidden="true" />
								</button>
								<button
									type="button"
									class="row-action"
									onclick={() => player.addToQueue(track, provenance)}
									aria-label={m.player_add_to_queue()}
								>
									<ListPlus size={16} aria-hidden="true" />
								</button>
							{/snippet}
						</MobileTrackRow>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="notice">{m.now_album_empty()}</p>
		{/if}

		<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</section>
{:else}
	<section class="album-detail" aria-labelledby="album-detail-title">
		<MobileSubScreenHeader
			backHref={homeHref}
			backLabel={m.now_detail_back()}
			heading={m.album_label()}
			headingId="album-detail-title"
		/>
		{#if state === 'not_connected' || state === 'authorization_expired'}
			<div class="notice" role="status">
				<p>{m.now_album_disconnected()}</p>
				<a class="notice-action" href={settingsHref}>{m.tidal_connect()}</a>
			</div>
		{:else if state === 'not_found' || state === 'invalid_id'}
			<div class="notice" role="status">
				<p>{m.now_album_not_found()}</p>
				<a class="notice-action" href={homeHref}>{m.now_idle_cta()}</a>
			</div>
		{:else}
			<div class="notice" role="alert">
				<p>{m.now_album_unavailable()}</p>
				<button type="button" class="notice-action" onclick={() => window.location.reload()}>
					{m.track_retry()}
				</button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.album-detail {
		max-width: 44rem;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}

	.album-hero {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		text-align: center;
	}

	.album-art {
		display: grid;
		place-items: center;
		width: min(64vw, 17rem);
		aspect-ratio: 1;
		overflow: hidden;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-selected);
		box-shadow: 0 24px 42px -26px rgb(6 48 100 / 40%);
	}

	.album-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.album-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}

	.album-meta span + span::before {
		margin-right: 0.5rem;
		content: '·';
	}

	.album-actions {
		display: flex;
		gap: 0.5rem;
		margin: clamp(1.25rem, 5vw, 1.75rem) 0 0.5rem;
	}

	.album-actions button {
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

	.album-actions .primary {
		flex: 1;
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.album-actions button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.album-tracks {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.row-action {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.row-action:active,
	.row-action:focus-visible {
		color: var(--action);
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
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
