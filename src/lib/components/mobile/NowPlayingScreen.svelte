<script lang="ts">
	import { getContext } from 'svelte';
	import { resolve } from '$app/paths';
	import { BadgeInfo, ChevronDown, Disc, ListMusic, ScrollText } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatReleaseDate } from '#lib/format';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import { player } from '#lib/player/player.svelte.js';
	import PlayerTransport from '#lib/components/player/PlayerTransport.svelte';
	import PlayerSeekBar from '#lib/components/player/PlayerSeekBar.svelte';
	import PlaybackStatus from '#lib/components/player/PlaybackStatus.svelte';
	import SessionSaveStatus from '#lib/components/player/SessionSaveStatus.svelte';
	import TrackActionMenu from '#lib/components/music/TrackActionMenu.svelte';
	import { MOBILE_PLAYER_NAVIGATION, type MobilePlayerNavigation } from '#lib/mobile/navigation';
	const navigation = getContext<MobilePlayerNavigation | undefined>(MOBILE_PLAYER_NAVIGATION);
	const track = $derived(player.currentTrack);
	const cover = $derived(trackArtworkUrl(track));
	const releaseYear = $derived(formatReleaseDate(track?.album?.releaseDate));
	let erroredTrackId = $state<string | null>(null);
</script>

<section class="now-screen" aria-labelledby="now-title">
	<h1 id="now-title" class="sr-only">{m.now_playing_heading()}</h1>
	<header class="now-header">
		<a
			href={navigation?.returnTo ?? resolve('/(mobile)/home')}
			class="now-icon"
			aria-label={m.now_close_player()}><ChevronDown size={24} aria-hidden="true" /></a
		>
		<p class="now-context">{track?.provenance ?? m.now_playing_heading()}</p>
		{#if track}<div class="now-header-actions">
				<SessionSaveStatus mobile /><TrackActionMenu {track} mobile />
			</div>{/if}
	</header>
	{#if track}
		<div class="now-content">
			<div class="now-artwork-wrap">
				<div class="now-artwork" style:view-transition-name="syn-now-art">
					{#if cover && erroredTrackId !== track.id}
						<img
							src={cover}
							fetchpriority="high"
							alt={m.player_cover_alt({ title: track.title })}
							onerror={() => (erroredTrackId = track?.id ?? null)}
						/>
					{:else}<Disc size={64} aria-hidden="true" />{/if}
				</div>
			</div>
			<div class="now-identity">
				<p class="now-track-title">{track.title}</p>
				<p class="now-artists">
					{#each track.artists as artist, index (`${artist.id}-${index}`)}
						{#if index > 0}<span aria-hidden="true"> · </span>{/if}
						<a href={resolve('/(mobile)/artists/[id]', { id: artist.id })}>{artist.name}</a>
					{/each}
				</p>
				{#if track.album}<a
						class="now-album"
						href={resolve('/(mobile)/albums/[id]', { id: track.album.id })}
						>{track.album.title}{releaseYear ? ` · ${releaseYear}` : ''}</a
					>{/if}
				{#if player.qualityLabel}<p class="now-quality">{player.qualityLabel}</p>{/if}
			</div>
			<div class="now-controls">
				<PlaybackStatus mobile />
				<PlayerSeekBar mobile />
				<PlayerTransport mobile />
				<nav class="now-secondary" aria-label={m.player_now_playing()}>
					<a href={resolve('/(mobile)/now/queue')} aria-label={m.now_queue_open()}
						><ListMusic size={20} aria-hidden="true" /><span
							>{m.player_queue()}{player.queueCount ? ` · ${player.queueCount}` : ''}</span
						></a
					>
					<a href={resolve('/(mobile)/now/lyrics')} aria-label={m.now_lyrics_open()}
						><ScrollText size={20} aria-hidden="true" /><span>{m.player_lyrics()}</span></a
					>
					<a href={resolve('/(mobile)/now/credits')} aria-label={m.now_credits_title()}
						><BadgeInfo size={20} aria-hidden="true" /><span>{m.now_credits_title()}</span></a
					>
					<a href={resolve('/(mobile)/tracks/[id]', { id: track.id })}
						><BadgeInfo size={20} aria-hidden="true" /><span>{m.track_details_label()}</span></a
					>
				</nav>
			</div>
		</div>
	{:else}
		<div class="now-idle">
			<Disc size={48} aria-hidden="true" />
			<p class="now-track-title">{m.now_idle_message()}</p>
			<p>{m.now_idle_description()}</p>
			<a href={resolve('/(mobile)/search')}>{m.now_idle_search()}</a><a
				href={resolve('/(mobile)/home')}>{m.now_idle_cta()}</a
			>
		</div>
	{/if}
</section>

<style>
	.now-screen {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 100dvh;
		min-height: 100%;
		box-sizing: border-box;
		padding: calc(0.35rem + env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
			calc(0.6rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: none;
		touch-action: manipulation;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.now-screen::-webkit-scrollbar {
		display: none;
	}

	.now-header {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		max-width: 36rem;
		width: 100%;
		margin: 0 auto clamp(0.25rem, 1vh, 0.65rem);
	}

	.now-icon {
		display: grid;
		flex: none;
		width: 48px;
		height: 48px;
		place-items: center;
		color: var(--text-primary);
		border-radius: var(--radius-full);
		touch-action: manipulation;
		transition: background-color var(--dur-fast) ease;
	}

	.now-icon:hover,
	.now-icon:active {
		background: var(--surface-selected);
	}

	.now-context {
		min-width: 0;
		text-align: center;
		font-size: var(--fs-xs);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now-header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
	}

	.now-content {
		display: flex;
		flex-direction: column;
		flex: 1 1 0;
		min-height: 0;
		width: min(100%, 26rem);
		margin: 0 auto;
		justify-content: space-between;
		gap: clamp(0.35rem, 1.5vh, 0.85rem);
	}

	.now-artwork-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 0;
		min-height: 0;
		min-width: 0;
		width: 100%;
	}

	.now-artwork {
		display: grid;
		place-items: center;
		height: 100%;
		max-height: min(100%, 23rem);
		max-width: 100%;
		aspect-ratio: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border-radius: var(--radius-xl);
		color: var(--text-secondary);
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-panel);
	}

	.now-artwork img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.now-identity {
		flex: none;
		min-width: 0;
		width: 100%;
	}

	.now-track-title {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: 700;
		line-height: 1.2;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		overflow: hidden;
	}

	.now-artists {
		margin: 0.25rem 0 0;
		font-size: var(--fs-base);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now-artists a,
	.now-album {
		color: inherit;
		text-decoration: none;
	}

	.now-album {
		display: block;
		margin-top: 0.15rem;
		font-size: var(--fs-sm);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now-quality {
		margin: 0.25rem 0 0;
		color: var(--text-secondary);
		font-size: var(--fs-xs);
	}

	.now-controls {
		display: flex;
		flex-direction: column;
		flex: none;
		gap: clamp(0.2rem, 1vh, 0.45rem);
		min-width: 0;
		width: 100%;
	}

	.now-secondary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.25rem;
		margin-top: clamp(0.2rem, 1vh, 0.45rem);
	}

	.now-secondary a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		min-height: 48px;
		padding: 0.35rem 0.15rem;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: var(--fs-xs);
		border-radius: var(--radius-md);
		text-align: center;
		overflow-wrap: anywhere;
		touch-action: manipulation;
		transition:
			color var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}

	.now-secondary a:hover,
	.now-secondary a:active {
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.now-idle {
		display: flex;
		flex: 1 1 0;
		min-height: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.now-idle a {
		display: grid;
		min-height: 48px;
		padding: 0.5rem 1rem;
		place-items: center;
		color: var(--action-contrast);
		background: var(--action);
		border-radius: var(--radius-full);
		text-decoration: none;
		touch-action: manipulation;
	}

	@media (orientation: landscape) and (max-height: 34rem),
		(min-width: 40rem) and (max-height: 34rem) {
		.now-content {
			display: grid;
			grid-template-columns: minmax(8rem, 0.75fr) minmax(14rem, 1.25fr);
			grid-template-rows: auto 1fr;
			align-items: center;
			column-gap: 1.25rem;
			row-gap: 0.35rem;
			width: min(100%, 52rem);
			height: 100%;
			flex: 1 1 0;
			min-height: 0;
		}

		.now-artwork-wrap {
			grid-column: 1;
			grid-row: 1 / 3;
			height: 100%;
			max-height: 100%;
			padding: 0;
		}

		.now-artwork {
			max-height: min(100%, 65dvh);
			max-width: min(100%, 65dvh);
			width: 100%;
			height: auto;
		}

		.now-identity {
			grid-column: 2;
			grid-row: 1;
		}

		.now-controls {
			grid-column: 2;
			grid-row: 2;
		}
	}
</style>
