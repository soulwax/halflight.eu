<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Disc, Play, Sparkles } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
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
		margin-bottom: 2.5rem;
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 2rem;
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
		font-size: clamp(2.2rem, 5vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.intro {
		margin: 0.75rem 0 0;
		color: var(--text-muted);
		font-size: 1.1rem;
		max-width: 40rem;
	}

	.mix-section {
		margin-bottom: 2.5rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: clamp(1.25rem, 3vw, 1.75rem);
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.section-heading h2 {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.02em;
	}

	.play-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--action);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.45rem 0.9rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
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
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 0.75rem;
	}

	.mix-footer {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.mix-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-primary);
		font-weight: 700;
		font-size: 0.9rem;
		text-transform: uppercase;
		text-decoration: none;
	}

	.mix-link:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 1.25rem;
	}

	.action-card {
		position: relative;
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		transition: all 0.12s ease;
	}

	.action-card:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-2px, -2px);
	}

	.card-indicator {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
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
		margin: 0 0 0.5rem;
		font-size: 1.2rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.01em;
	}

	.action-card p {
		margin: 0 0 1.5rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		flex: 1;
	}

	.action-card a {
		display: inline-flex;
		min-height: 2.6rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-strong);
		background: var(--surface-canvas);
		padding: 0.5rem 1rem;
		color: var(--text-primary);
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.action-card a:hover {
		background: var(--action);
		color: var(--action-contrast);
		border-color: var(--action);
	}

	.connect-card {
		max-width: 32rem;
	}
</style>
