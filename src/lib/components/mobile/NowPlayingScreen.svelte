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

	const lyricsSnippet = $derived.by(() => {
		if (!player.lyrics) return '';
		const lines = player.lyrics
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		return lines.slice(0, 2).join(' · ');
	});
</script>

<section class="now-screen" aria-labelledby="now-title">
	<h1 id="now-title" class="sr-only">{m.now_playing_heading()}</h1>

	<!-- Spotify Top Bar -->
	<header class="now-header">
		<a
			href={navigation?.returnTo ?? resolve('/(mobile)/home')}
			class="now-icon"
			aria-label={m.now_close_player()}
		>
			<ChevronDown size={24} aria-hidden="true" />
		</a>

		<div class="now-context">
			<span class="now-context-label">{m.player_now_playing().toUpperCase()}</span>
			<span class="now-context-source">
				{track?.provenance ?? track?.album?.title ?? m.now_playing_heading()}
			</span>
		</div>

		{#if track}
			<div class="now-header-actions">
				<SessionSaveStatus mobile />
				<TrackActionMenu {track} mobile />
			</div>
		{:else}
			<div class="now-header-spacer" aria-hidden="true"></div>
		{/if}
	</header>

	{#if track}
		<div class="now-content">
			<!-- Fluid Artwork Container -->
			<div class="now-artwork-wrap">
				<div class="now-artwork" style:view-transition-name="syn-now-art">
					{#if cover && erroredTrackId !== track.id}
						<img
							src={cover}
							fetchpriority="high"
							alt={m.player_cover_alt({ title: track.title })}
							onerror={() => (erroredTrackId = track?.id ?? null)}
						/>
					{:else}
						<Disc size={64} aria-hidden="true" />
					{/if}
				</div>
			</div>

			<!-- Spotify Track Identity -->
			<div class="now-identity">
				<div class="now-identity-main">
					<p class="now-track-title">{track.title}</p>
					<p class="now-artists">
						{#each track.artists as artist, index (`${artist.id}-${index}`)}
							{#if index > 0}<span aria-hidden="true"> · </span>{/if}
							<a href={resolve('/(mobile)/artists/[id]', { id: artist.id })}>{artist.name}</a>
						{/each}
					</p>
					<div class="now-meta-row">
						{#if track.album}
							<a class="now-album" href={resolve('/(mobile)/albums/[id]', { id: track.album.id })}
								>{track.album.title}{releaseYear ? ` · ${releaseYear}` : ''}</a
							>
						{/if}
						{#if player.qualityLabel}
							<span class="now-quality-tag">{player.qualityLabel}</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Player Controls & Utilities -->
			<div class="now-controls">
				<PlaybackStatus mobile />
				<PlayerSeekBar mobile />
				<PlayerTransport mobile />

				<!-- Spotify Bottom Utilities Bar (Details, Credits, Queue) -->
				<nav class="now-utility-bar" aria-label={m.player_now_playing()}>
					<div class="now-utility-left">
						<a
							href={resolve('/(mobile)/tracks/[id]', { id: track.id })}
							class="now-util-btn"
							aria-label={m.track_details_label()}
							title={m.track_details_label()}
						>
							<BadgeInfo size={19} aria-hidden="true" />
							<span class="now-util-label">{m.track_details_label()}</span>
						</a>
						<a
							href={resolve('/(mobile)/now/credits')}
							class="now-util-btn"
							aria-label={m.now_credits_title()}
							title={m.now_credits_title()}
						>
							<ScrollText size={19} aria-hidden="true" />
							<span class="now-util-label">{m.now_credits_title()}</span>
						</a>
					</div>
					<div class="now-utility-right">
						<a
							href={resolve('/(mobile)/now/queue')}
							class="now-util-btn now-queue-btn"
							aria-label={m.now_queue_open()}
							title={m.now_queue_open()}
						>
							<ListMusic size={20} aria-hidden="true" />
							<span class="now-util-label">{m.player_queue()}</span>
							{#if player.queueCount}
								<span class="now-queue-badge">{player.queueCount}</span>
							{/if}
						</a>
					</div>
				</nav>

				<!-- Spotify Signature Lyrics Card -->
				<a
					href={resolve('/(mobile)/now/lyrics')}
					class="now-lyrics-card"
					aria-label={m.now_lyrics_open()}
				>
					<div class="now-lyrics-header">
						<span class="now-lyrics-badge">{m.player_lyrics().toUpperCase()}</span>
						<span class="now-lyrics-action" aria-hidden="true">
							<ScrollText size={15} />
						</span>
					</div>
					<p class="now-lyrics-preview">
						{#if player.lyricsCues.length}
							{player.lyricsCues[player.activeLyricIndex]?.text ||
								player.lyricsCues[0]?.text ||
								m.player_lyrics()}
						{:else if player.lyrics}
							{lyricsSnippet || m.player_lyrics()}
						{:else if player.isLyricsLoading}
							{m.now_lyrics_loading()}
						{:else}
							{m.player_lyrics()}
						{/if}
					</p>
				</a>
			</div>
		</div>
	{:else}
		<div class="now-idle">
			<div class="now-idle-icon-wrap">
				<Disc size={52} aria-hidden="true" />
			</div>
			<p class="now-track-title">{m.now_idle_message()}</p>
			<p class="now-idle-desc">{m.now_idle_description()}</p>
			<div class="now-idle-actions">
				<a href={resolve('/(mobile)/search')} class="now-idle-btn primary">{m.now_idle_search()}</a>
				<a href={resolve('/(mobile)/home')} class="now-idle-btn secondary">{m.now_idle_cta()}</a>
			</div>
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
			calc(0.5rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: none;
		touch-action: manipulation;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		background: linear-gradient(
			180deg,
			rgba(34, 34, 42, 0.95) 0%,
			rgba(20, 20, 25, 0.98) 42%,
			#0d0d10 100%
		);
	}

	.now-screen::-webkit-scrollbar {
		display: none;
	}

	/* Top Bar */
	.now-header {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		max-width: 36rem;
		width: 100%;
		margin: 0 auto clamp(0.15rem, 0.8vh, 0.45rem);
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
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color var(--dur-fast) ease,
			transform var(--dur-fast) ease;
	}

	.now-icon:hover,
	.now-icon:active {
		background: var(--surface-selected);
		transform: scale(0.95);
	}

	.now-context {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
		text-align: center;
		gap: 0.1rem;
	}

	.now-context-label {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-secondary);
		line-height: 1.1;
	}

	.now-context-source {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 14rem;
	}

	.now-header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
	}

	.now-header-spacer {
		width: 48px;
		height: 48px;
		flex: none;
	}

	/* Main Content Column */
	.now-content {
		display: flex;
		flex-direction: column;
		flex: 1 1 0;
		min-height: 0;
		width: min(100%, 26rem);
		margin: 0 auto;
		justify-content: space-between;
		gap: clamp(0.3rem, 1vh, 0.65rem);
	}

	/* Fluid Album Art */
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
		border-radius: 8px; /* Spotify's signature 8px rounded corners */
		color: var(--text-secondary);
		background: #1e1e24;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow:
			0 16px 40px -8px rgba(0, 0, 0, 0.75),
			0 6px 16px rgba(0, 0, 0, 0.5);
	}

	.now-artwork img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Track Identity */
	.now-identity {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		flex: none;
		min-width: 0;
		width: 100%;
	}

	.now-identity-main {
		min-width: 0;
		flex: 1 1 auto;
	}

	.now-track-title {
		margin: 0;
		font-size: clamp(1.2rem, 3.8vw, 1.45rem);
		font-weight: 700;
		line-height: 1.22;
		letter-spacing: -0.02em;
		color: var(--text-primary);
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
		font-weight: 400;
	}

	.now-artists a {
		color: inherit;
		text-decoration: none;
		transition: color var(--dur-fast) ease;
	}

	.now-artists a:hover,
	.now-artists a:active {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.now-meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.2rem;
		min-width: 0;
	}

	.now-album {
		font-size: var(--fs-xs);
		color: var(--text-muted);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		transition: color var(--dur-fast) ease;
	}

	.now-album:hover,
	.now-album:active {
		color: var(--text-secondary);
		text-decoration: underline;
	}

	.now-quality-tag {
		flex: none;
		font-size: 0.625rem;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.12);
		color: var(--text-secondary);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	/* Controls Area */
	.now-controls {
		display: flex;
		flex-direction: column;
		flex: none;
		gap: clamp(0.15rem, 0.7vh, 0.35rem);
		min-width: 0;
		width: 100%;
	}

	/* Spotify Bottom Utility Bar */
	.now-utility-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		width: 100%;
		padding: 0 0.15rem;
	}

	.now-utility-left,
	.now-utility-right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.now-util-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 48px;
		padding: 0 0.5rem;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: var(--fs-xs);
		font-weight: 500;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			color var(--dur-fast) ease,
			background-color var(--dur-fast) ease,
			transform var(--dur-fast) ease;
	}

	.now-util-btn:hover,
	.now-util-btn:active {
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.now-util-btn:active {
		transform: scale(0.95);
	}

	.now-queue-badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.25rem;
		border-radius: var(--radius-full);
		background: var(--action);
		color: var(--action-contrast);
		font-size: 0.625rem;
		font-weight: 700;
		line-height: 1;
	}

	/* Spotify Signature Lyrics Card */
	.now-lyrics-card {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.5rem 0.85rem;
		border-radius: var(--radius-lg);
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.09) 0%,
			rgba(255, 255, 255, 0.03) 100%
		);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
		text-decoration: none;
		min-height: 48px;
		box-sizing: border-box;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			background var(--dur-fast) ease,
			transform var(--dur-fast) ease,
			border-color var(--dur-fast) ease;
	}

	.now-lyrics-card:hover {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.13) 0%,
			rgba(255, 255, 255, 0.05) 100%
		);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.now-lyrics-card:active {
		transform: scale(0.985);
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.16) 0%,
			rgba(255, 255, 255, 0.07) 100%
		);
	}

	.now-lyrics-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.now-lyrics-badge {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
	}

	.now-lyrics-action {
		color: var(--text-secondary);
		display: grid;
		place-items: center;
	}

	.now-lyrics-preview {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.28;
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		overflow: hidden;
	}

	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Idle State */
	.now-idle {
		display: flex;
		flex: 1 1 0;
		min-height: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		text-align: center;
		color: var(--text-secondary);
		padding: 2rem 1.5rem;
	}

	.now-idle-icon-wrap {
		display: grid;
		place-items: center;
		width: 80px;
		height: 80px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.now-idle-desc {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text-secondary);
		max-width: 20rem;
		line-height: 1.4;
	}

	.now-idle-actions {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		width: 100%;
		max-width: 16rem;
		margin-top: 0.5rem;
	}

	.now-idle-actions a {
		display: grid;
		min-height: 48px;
		padding: 0.6rem 1.25rem;
		place-items: center;
		border-radius: var(--radius-full);
		text-decoration: none;
		font-weight: 700;
		font-size: var(--fs-sm);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform var(--dur-fast) ease,
			opacity var(--dur-fast) ease;
	}

	.now-idle-actions a:active {
		transform: scale(0.97);
	}

	.now-idle-actions a:first-child {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.now-idle-actions a:last-child {
		color: var(--action-contrast);
		background: var(--action);
	}

	/* Landscape Responsive Grid */
	@media (orientation: landscape) and (max-height: 34rem),
		(min-width: 40rem) and (max-height: 34rem) {
		.now-screen {
			padding: calc(0.2rem + env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
				calc(0.25rem + env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
		}

		.now-header {
			margin: 0 auto 0.15rem;
		}

		.now-header .now-icon,
		.now-header .now-header-spacer {
			width: 38px;
			height: 38px;
		}

		.now-context-label {
			font-size: 0.5625rem;
		}

		.now-context-source {
			font-size: 0.75rem;
			max-width: 12rem;
		}

		.now-content {
			display: grid;
			grid-template-columns: minmax(7rem, 0.7fr) minmax(14rem, 1.3fr);
			grid-template-rows: auto 1fr;
			align-items: center;
			column-gap: 1rem;
			row-gap: 0.2rem;
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
			display: grid;
			place-items: center;
		}

		.now-artwork {
			max-height: min(100%, 55dvh);
			max-width: min(100%, 55dvh);
			width: 100%;
			height: auto;
		}

		.now-identity {
			grid-column: 2;
			grid-row: 1;
			margin-bottom: 0;
		}

		.now-track-title {
			font-size: 1.05rem;
			line-height: 1.15;
			-webkit-line-clamp: 1;
			line-clamp: 1;
			margin: 0;
		}

		.now-artists {
			font-size: 0.8125rem;
			line-height: 1.15;
			margin-top: 0.1rem;
			-webkit-line-clamp: 1;
			line-clamp: 1;
		}

		.now-meta-row {
			margin-top: 0.1rem;
			font-size: 0.6875rem;
		}

		.now-controls {
			grid-column: 2;
			grid-row: 2;
			gap: 0.125rem;
		}

		.now-utility-bar {
			padding: 0;
		}

		.now-util-btn {
			min-height: 32px;
			padding: 0 0.35rem;
			font-size: 0.6875rem;
			gap: 0.25rem;
		}

		.now-lyrics-card {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			min-height: 28px;
			padding: 0.2rem 0.6rem;
			gap: 0.5rem;
			margin-top: 0.05rem;
		}

		.now-lyrics-header {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			flex: none;
			margin: 0;
		}

		.now-lyrics-badge {
			font-size: 0.5625rem;
			padding: 1px 4px;
		}

		.now-lyrics-action {
			display: none;
		}

		.now-lyrics-preview {
			flex: 1 1 0;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 0.75rem;
			line-height: 1.2;
			-webkit-line-clamp: 1;
			line-clamp: 1;
			margin: 0;
		}
	}
</style>
