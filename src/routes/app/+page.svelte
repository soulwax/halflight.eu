<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ListMusic, Play, Plus, Sparkles, Trash2, Wand2 } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Syn</title>
	<meta name="description" content={m.home_subtitle()} />
</svelte:head>

<section class="welcome" aria-labelledby="home-title">
	<header class="hero-header">
		<div class="hero-mark" aria-hidden="true">
			<span class="hero-mark-line"></span>
			<span class="hero-mark-node"></span>
			<span class="hero-mark-line"></span>
		</div>
		<p class="deco-eyebrow">SYN — Sound Laboratory</p>
		<h1 id="home-title" class="hero-title">{m.home_title({ name: data.user.name })}</h1>
		<p class="intro">{m.home_subtitle()}</p>
	</header>

	{#if data.connection.connected}
		<!-- Bauhaus Composer Banner -->
		<section class="composer-hero" aria-labelledby="composer-heading">
			<div class="composer-content">
				<div class="composer-badge">
					<Sparkles size={16} class="text-[var(--action-contrast)]" />
					<span>AUTONOMOUS COMPOSER</span>
				</div>
				<h2 id="composer-heading">GENERATE PLAYLISTS ON THE FLY</h2>
				<p class="composer-desc">
					Answer 3 quick aesthetic questions (vibe, era cycle, pacing) to synthesize a custom
					20-track thematic playlist and start playback immediately.
				</p>
			</div>
			<div class="composer-action">
				<Button variant="primary" size="lg" onclick={() => customPlaylists.openGenerator()}>
					<Wand2 size={16} />
					COMPOSE PLAYLIST
				</Button>
			</div>
		</section>

		<!-- Custom Playlists Section -->
		{#if customPlaylists.playlists.length > 0}
			<section class="custom-playlists-section" aria-labelledby="custom-playlists-heading">
				<SectionHeader
					eyebrow="USER ARCHIVE // ON THE FLY"
					title="MY CUSTOM PLAYLISTS"
					titleId="custom-playlists-heading"
					count={customPlaylists.playlists.length}
				>
					{#snippet actions()}
						<Button variant="secondary" size="sm" onclick={() => customPlaylists.openGenerator()}>
							<Plus size={14} />
							COMPOSE NEW
						</Button>
					{/snippet}
				</SectionHeader>

				<div class="custom-playlists-grid">
					{#each customPlaylists.playlists as playlist (playlist.id)}
						<article class="custom-playlist-card">
							<div class="pl-card-header">
								<div class="pl-icon-wrap">
									<ListMusic size={20} class="text-[var(--action)]" />
								</div>
								<div class="pl-meta">
									<strong class="pl-title">{playlist.title}</strong>
									<span class="pl-count font-mono">{playlist.items.length} tracks</span>
								</div>
							</div>

							{#if playlist.description}
								<p class="pl-desc">{playlist.description}</p>
							{/if}

							<div class="pl-actions">
								<button
									type="button"
									class="pl-play-btn"
									disabled={playlist.items.length === 0}
									onclick={() => customPlaylists.playPlaylist(playlist.id)}
								>
									<Play size={13} fill="currentColor" />
									PLAY
								</button>
								<button
									type="button"
									class="pl-delete-btn"
									onclick={() => customPlaylists.deletePlaylist(playlist.id)}
									title="Delete playlist"
									aria-label="Delete playlist"
								>
									<Trash2 size={13} />
								</button>
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.dailyMix.length}
			<section class="mix-section" aria-labelledby="daily-mix-title">
				<SectionHeader
					eyebrow="CURATED SOUNDS"
					title={m.home_daily_mix_title()}
					titleId="daily-mix-title"
				>
					<Sparkles size={16} class="text-[var(--action)]" />
					{#snippet actions()}
						<Button variant="primary" onclick={() => player.play(data.dailyMix[0], data.dailyMix)}>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>
					{/snippet}
				</SectionHeader>

				<div class="song-cards-grid">
					{#each data.dailyMix as track, index (track.id)}
						<SongCard {track} contextTracks={data.dailyMix} {index} />
					{/each}
				</div>

				<div class="mix-footer">
					<a class="mix-link" href={resolve('/app/mixes')}>
						{m.home_daily_mix_more()}
						<ArrowRight size={15} />
					</a>
				</div>
			</section>
		{/if}

		<div class="actions-grid">
			<article class="action-card">
				<div class="card-indicator indicator-blue"></div>
				<h2>{m.home_search_title()}</h2>
				<p>{m.home_search_description()}</p>
				<a href={resolve('/app/search')}>{m.home_search_button()}</a>
			</article>

			<article class="action-card">
				<div class="card-indicator indicator-yellow"></div>
				<h2>{m.home_library_title()}</h2>
				<p>{m.home_library_description()}</p>
				<a href={resolve('/app/library')}>{m.home_library_button()}</a>
			</article>

			<article class="action-card">
				<div class="card-indicator indicator-red"></div>
				<h2>{m.mixes_title()}</h2>
				<p>{m.mixes_subtitle()}</p>
				<a href={resolve('/app/mixes')}>{m.nav_mixes()}</a>
			</article>
		</div>
	{:else}
		<StateCard
			state="not_connected"
			title={m.home_connect_title()}
			description={m.home_connect_description()}
		/>
	{/if}
</section>

<style>
	.welcome {
		max-width: 100%;
	}

	.hero-header {
		position: relative;
		margin-bottom: var(--space-section);
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: clamp(1.75rem, 4vw, 2.75rem);
	}

	.hero-mark {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.hero-mark-line {
		width: 2rem;
		height: 1px;
		background: var(--accent-gold);
	}

	.hero-mark-node {
		width: 6px;
		height: 6px;
		background: var(--accent-gold);
		rotate: 45deg;
	}

	.hero-title {
		margin: 0.35rem 0 0.5rem;
		font-size: clamp(2rem, 5vw, 3.25rem);
		font-weight: 700;
		color: var(--text-primary);
	}

	.intro {
		margin: 0;
		color: var(--text-muted);
		font-size: 1rem;
		max-width: 48rem;
		line-height: 1.55;
	}

	.composer-hero {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: clamp(1.5rem, 3.5vw, 2.5rem);
		border: 1px solid var(--accent-gold);
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--accent-gold) 10%, var(--surface-raised)),
			var(--surface-raised)
		);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-raised);
		margin-bottom: 3.5rem;
	}

	.composer-content {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-width: 36rem;
	}

	.composer-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: fit-content;
		padding: 0.2rem 0.6rem;
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		border-radius: var(--radius-sm);
	}

	.composer-content h2 {
		margin: 0.2rem 0 0;
		font-size: clamp(1.2rem, 3vw, 1.65rem);
		font-weight: 800;
		color: var(--text-primary);
	}

	.composer-desc {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.custom-playlists-section {
		margin-bottom: 3.5rem;
	}

	.custom-playlists-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.custom-playlist-card {
		padding: 1.15rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.85rem;
		transition: all 0.12s ease;
	}

	.custom-playlist-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.pl-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.pl-icon-wrap {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}

	.pl-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.pl-title {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pl-count {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.pl-desc {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.pl-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-top: 1px dashed var(--border-subtle);
		padding-top: 0.65rem;
	}

	.pl-play-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		background: var(--action);
		color: var(--action-contrast);
		border: 1px solid var(--action);
		border-radius: var(--radius-sm);
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.pl-play-btn:hover:not(:disabled) {
		background: var(--accent-gold-deep);
		transform: scale(1.03);
	}

	.pl-play-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.pl-delete-btn {
		padding: 0.35rem 0.45rem;
		color: var(--text-muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.pl-delete-btn:hover {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-subtle);
	}

	.mix-section {
		margin-bottom: 3.5rem;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.15rem;
		margin-top: 1rem;
	}

	.mix-footer {
		margin-top: 1.5rem;
		display: flex;
		justify-content: flex-end;
	}

	.mix-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--action);
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transition: transform 0.1s ease;
	}

	.mix-link:hover {
		transform: translateX(3px);
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1.25rem;
		margin-top: 3.5rem;
	}

	.action-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 1.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-md);
		transition: all 0.14s ease;
	}

	.action-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.card-indicator {
		width: 2rem;
		height: 3px;
		border-radius: var(--radius-full);
	}

	.indicator-blue {
		background: var(--bauhaus-blue);
	}
	.indicator-yellow {
		background: var(--accent-gold);
	}
	.indicator-red {
		background: var(--accent-oxblood);
	}

	.action-card h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.action-card p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.88rem;
		line-height: 1.5;
		flex: 1;
	}

	.action-card a {
		align-self: flex-start;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		color: var(--text-primary);
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.action-card a:hover {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}
</style>
