<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ListMusic, Play, Plus, Sparkles, Trash2, Wand2 } from '@lucide/svelte';

	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
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
		<h1 id="home-title">{m.home_title({ name: data.user.name })}</h1>
		<p class="intro">{m.home_subtitle()}</p>
	</header>

	{#if data.connection.connected}
		<!-- Bauhaus Composer Banner: Perfect for Empty Accounts & Discovery -->
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
				<button
					type="button"
					class="composer-launch-btn"
					onclick={() => customPlaylists.openGenerator()}
				>
					<Wand2 size={16} />
					COMPOSE PLAYLIST
				</button>
			</div>
		</section>

		<!-- Custom Playlists Section -->
		{#if customPlaylists.playlists.length > 0}
			<section class="custom-playlists-section" aria-labelledby="custom-playlists-heading">
				<div class="section-heading">
					<div>
						<p class="eyebrow">USER ARCHIVE // ON THE FLY</p>
						<h2 id="custom-playlists-heading">MY CUSTOM PLAYLISTS</h2>
					</div>
					<button
						type="button"
						class="create-pl-btn"
						onclick={() => customPlaylists.openGenerator()}
					>
						<Plus size={14} />
						COMPOSE NEW
					</button>
				</div>

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
				<div class="section-heading">
					<div>
						<p class="eyebrow">
							<Sparkles size={14} class="inline text-[var(--action)]" /> CURATED SOUNDS
						</p>
						<h2 id="daily-mix-title">{m.home_daily_mix_title()}</h2>
					</div>
					<div class="mix-header-actions">
						<button
							type="button"
							class="play-mix-btn"
							onclick={() => player.play(data.dailyMix[0], data.dailyMix)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</button>
					</div>
				</div>

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
		<article class="action-card connect-card">
			<div class="card-indicator indicator-red"></div>
			<h2>{m.home_connect_title()}</h2>
			<p>{m.home_connect_description()}</p>
			<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
		</article>
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
		gap: 0.6rem;
		width: 7rem;
		margin-bottom: 1.75rem;
	}

	.hero-mark-line {
		height: 1px;
		flex: 1;
		background: var(--accent-gold-deep);
	}

	.hero-mark-node {
		width: 6px;
		height: 6px;
		rotate: 45deg;
		background: var(--accent-gold);
	}

	h1 {
		margin: 0.9rem 0 0;
		font-size: clamp(2.6rem, 5.5vw, 4.25rem);
		letter-spacing: 0.005em;
		line-height: 1.06;
	}

	.intro {
		margin: 1.1rem 0 0;
		max-width: 42rem;
		color: var(--text-muted);
		font-size: 1.15rem;
		line-height: 1.65;
	}

	/* Composer Hero Banner */
	.composer-hero {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 2.25rem;
		margin-bottom: var(--space-section);
		padding: clamp(2rem, 4vw, 3rem);
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-bauhaus);
		overflow: hidden;
	}

	.composer-hero::before {
		content: '';
		position: absolute;
		inset: 7px;
		border: 1px solid color-mix(in oklab, var(--accent-gold) 22%, transparent);
		pointer-events: none;
	}

	.composer-content {
		max-width: 38rem;
	}

	.composer-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.85rem;
		border: 1px solid var(--accent-gold-deep);
		color: var(--accent-gold);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		border-radius: 0;
		margin-bottom: 1.1rem;
	}

	.composer-hero h2 {
		margin: 0 0 0.6rem;
		font-size: clamp(1.5rem, 2.5vw, 1.9rem);
		letter-spacing: 0.02em;
	}

	.composer-desc {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.composer-launch-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.85rem 1.6rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-md, 8px);
		background: var(--action);
		color: var(--action-contrast);
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: 3px 3px 0px var(--border-strong);
		transition: all 0.12s ease;
	}

	.composer-launch-btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: 4px 4px 0px var(--border-strong);
	}

	/* Custom Playlists */
	.custom-playlists-section {
		margin-bottom: 3.5rem;
	}

	.custom-playlists-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
		gap: 1.25rem;
	}

	.custom-playlist-card {
		padding: 1.25rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 12px);
		background: var(--surface-canvas);
		display: flex;
		flex-direction: column;
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
		gap: 0.85rem;
	}

	.pl-icon-wrap {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md, 8px);
		background: var(--surface-selected);
	}

	.pl-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.pl-title {
		font-size: 0.95rem;
		font-weight: 800;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pl-count {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.pl-desc {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.pl-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-subtle);
	}

	.pl-play-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.95rem;
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

	.pl-play-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.pl-play-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pl-delete-btn {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.pl-delete-btn:hover {
		border-color: var(--danger);
		color: var(--danger);
		background: var(--danger-subtle);
	}

	.create-pl-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.95rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.create-pl-btn:hover {
		border-color: var(--action);
		color: var(--action);
	}

	/* Mix Section */
	.mix-section {
		margin-bottom: var(--space-section);
	}

	.section-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 1.1rem;
	}

	.section-heading h2 {
		margin: 0;
		font-size: clamp(1.5rem, 2.4vw, 1.95rem);
		letter-spacing: 0.02em;
	}

	.play-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--accent-gold-deep);
		border-radius: 0;
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.6rem 1.3rem;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			filter 0.14s ease,
			box-shadow 0.14s ease;
	}

	.play-mix-btn:hover {
		box-shadow: var(--shadow-bauhaus-hover);
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
		gap: 1.15rem;
	}

	.mix-footer {
		margin-top: 1.5rem;
		display: flex;
		justify-content: flex-end;
	}

	.mix-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-primary);
		font-weight: 600;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		text-decoration: none;
		border-bottom: 1px solid var(--accent-gold);
		padding-bottom: 0.3rem;
		transition:
			color 0.14s ease,
			gap 0.14s ease;
	}

	.mix-link:hover {
		color: var(--action);
		gap: 0.75rem;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1.75rem;
	}

	.action-card {
		position: relative;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		padding: clamp(1.75rem, 3.5vw, 2.5rem);
		overflow: hidden;
		transition:
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}

	.action-card::before {
		content: '';
		position: absolute;
		inset: 6px;
		border: 1px solid transparent;
		transition: border-color 0.16s ease;
		pointer-events: none;
	}

	.action-card:hover {
		border-color: var(--accent-gold-deep);
		box-shadow: var(--shadow-bauhaus);
	}

	.action-card:hover::before {
		border-color: color-mix(in oklab, var(--accent-gold) 24%, transparent);
	}

	.card-indicator {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
	}

	.indicator-blue {
		background: var(--accent-jade);
	}
	.indicator-yellow {
		background: var(--accent-gold);
	}
	.indicator-red {
		background: var(--accent-oxblood);
	}

	.action-card h2 {
		margin: 0.65rem 0 0.6rem;
		font-size: 1.35rem;
		letter-spacing: 0.02em;
	}

	.action-card p {
		margin: 0 0 1.75rem;
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.action-card a {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--accent-gold-deep);
		border-radius: 0;
		background: var(--action);
		padding: 0.65rem 1.5rem;
		color: var(--action-contrast);
		font-weight: 700;
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		text-decoration: none;
		transition:
			filter 0.14s ease,
			box-shadow 0.14s ease;
	}

	.action-card a:hover {
		box-shadow: var(--shadow-bauhaus-hover);
	}

	.connect-card {
		max-width: 34rem;
	}
</style>
