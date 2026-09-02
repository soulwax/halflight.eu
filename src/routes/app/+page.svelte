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
	<title>Syn — Bauhaus Sound</title>
	<meta name="description" content={m.home_subtitle()} />
</svelte:head>

<section class="welcome" aria-labelledby="home-title">
	<header class="hero-header">
		<div class="stripe-bar" aria-hidden="true">
			<span class="stripe stripe-blue"></span>
			<span class="stripe stripe-red"></span>
			<span class="stripe stripe-yellow"></span>
		</div>
		<p class="eyebrow">SYN // SOUND LABORATORY</p>
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
		max-width: 64rem;
	}

	.hero-header {
		position: relative;
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 1.75rem;
	}

	.stripe-bar {
		display: flex;
		height: 4px;
		width: 4.5rem;
		margin-bottom: 1.5rem;
		gap: 2px;
	}

	.stripe {
		flex: 1;
	}

	.stripe-blue {
		background: var(--bauhaus-blue);
	}
	.stripe-red {
		background: var(--bauhaus-red);
	}
	.stripe-yellow {
		background: var(--bauhaus-yellow);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 5vw, 3.8rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.intro {
		margin: 0.75rem 0 0;
		color: var(--text-muted);
		font-size: 1.1rem;
		line-height: 1.5;
	}

	/* Composer Hero Banner */
	.composer-hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 2rem;
		margin-bottom: 3.5rem;
		padding: 2rem 2.25rem;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-lg, 14px);
		box-shadow: var(--shadow-bauhaus);
	}

	.composer-content {
		max-width: 38rem;
	}

	.composer-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.25rem 0.75rem;
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border-radius: var(--radius-full, 9999px);
		margin-bottom: 0.85rem;
	}

	.composer-hero h2 {
		margin: 0 0 0.5rem;
		font-size: 1.45rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
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
		margin-bottom: 4rem;
	}

	.section-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 0.85rem;
	}

	.section-heading h2 {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		text-transform: uppercase;
	}

	.play-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.5rem 1.15rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.play-mix-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
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
		gap: 0.45rem;
		color: var(--text-primary);
		font-weight: 800;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
		border-bottom: 2px solid var(--action);
		padding-bottom: 0.2rem;
		transition: all 0.12s ease;
	}

	.mix-link:hover {
		color: var(--action);
		gap: 0.65rem;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1.5rem;
	}

	.action-card {
		position: relative;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
		overflow: hidden;
		transition: all 0.15s ease;
	}

	.action-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.card-indicator {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
	}

	.indicator-blue {
		background: var(--bauhaus-blue);
	}
	.indicator-yellow {
		background: var(--bauhaus-yellow);
	}
	.indicator-red {
		background: var(--bauhaus-red);
	}

	.action-card h2 {
		margin: 0.5rem 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}

	.action-card p {
		margin: 0 0 1.5rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.action-card a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		padding: 0.6rem 1.25rem;
		color: var(--action-contrast);
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;

		text-decoration: none;
		transition: all 0.12s ease;
	}

	.action-card a:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.connect-card {
		max-width: 34rem;
	}
</style>
