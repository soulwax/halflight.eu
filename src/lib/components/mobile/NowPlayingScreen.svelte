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
		{#if track}<TrackActionMenu {track} mobile />{/if}
	</header>
	{#if track}
		<div class="now-content">
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
				</nav>
				<SessionSaveStatus />
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
		min-height: 100%;
		padding: calc(0.5rem + env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
			calc(1rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
	}
	.now-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		max-width: 36rem;
		margin: 0 auto 1rem;
	}
	.now-icon {
		display: grid;
		flex: none;
		width: 48px;
		height: 48px;
		place-items: center;
		color: var(--text-primary);
		border-radius: var(--radius-full);
	}
	.now-context {
		min-width: 0;
		text-align: center;
		font-size: var(--fs-xs);
		color: var(--text-secondary);
		overflow-wrap: anywhere;
	}
	.now-content {
		display: grid;
		gap: clamp(0.85rem, 2vh, 1.5rem);
		width: min(100%, 26rem);
		margin: 0 auto;
	}
	.now-artwork {
		display: grid;
		place-items: center;
		width: min(100%, 38dvh);
		min-width: 0;
		aspect-ratio: 1;
		justify-self: center;
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
	.now-track-title {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: 700;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.now-artists {
		margin: 0.45rem 0;
		font-size: var(--fs-base);
		color: var(--text-secondary);
		overflow-wrap: anywhere;
	}
	.now-artists a,
	.now-album {
		color: inherit;
		text-decoration: none;
	}
	.now-album {
		display: inline-block;
		font-size: var(--fs-sm);
		color: var(--text-secondary);
	}
	.now-quality {
		margin: 0.5rem 0 0;
		color: var(--text-secondary);
		font-size: var(--fs-xs);
	}
	.now-controls {
		display: grid;
		gap: 0.65rem;
		min-width: 0;
	}
	.now-secondary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.25rem;
		margin-top: 0.75rem;
	}
	.now-secondary a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-height: 48px;
		padding: 0.5rem 0;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: var(--fs-xs);
		border-radius: var(--radius-md);
		text-align: center;
		overflow-wrap: anywhere;
	}
	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.now-idle {
		display: flex;
		min-height: 60dvh;
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
	}
	@media (min-width: 40rem) and (max-height: 34rem) {
		.now-content {
			width: min(100%, 52rem);
			grid-template-columns: minmax(10rem, 0.8fr) minmax(18rem, 1fr);
			align-items: center;
			column-gap: 1.5rem;
		}
		.now-artwork {
			grid-column: 1;
			grid-row: 1 / 3;
			width: min(100%, 65dvh);
		}
		.now-identity,
		.now-controls {
			grid-column: 2;
		}
	}
</style>
