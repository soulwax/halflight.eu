<script lang="ts">
	import { resolve } from '$app/paths';
	import { Compass, ExternalLink, Flame, Play, Sparkles } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let activeTab = $state<'daily' | 'discovery' | 'newRelease'>('daily');

	const currentMix = $derived(
		activeTab === 'daily'
			? data.dailyMix
			: activeTab === 'discovery'
				? data.discoveryMix
				: data.newReleaseMix
	);

	const mixTidalUrl = $derived(
		currentMix?.id
			? `https://tidal.com/browse/mix/${encodeURIComponent(currentMix.id)}`
			: 'https://tidal.com/browse/mixes'
	);
</script>

<svelte:head>
	<title>{m.mixes_title()} — Syn</title>
	<meta name="description" content={m.mixes_subtitle()} />
</svelte:head>

<section class="mixes-page" aria-labelledby="mixes-title">
	<header class="mixes-header">
		<p class="eyebrow">SYN // AUTOMATED COMPOSITION</p>
		<h1 id="mixes-title">{m.mixes_title()}</h1>
		<p class="intro">{m.mixes_subtitle()}</p>
	</header>

	{#if !data.connected}
		<section class="state-card" aria-labelledby="connect-title">
			<h2 id="connect-title">{m.mixes_not_connected_title()}</h2>
			<p>{m.mixes_not_connected_description()}</p>
			{#if data.configured}
				<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
			{:else}
				<p>{m.tidal_not_configured()}</p>
			{/if}
		</section>
	{:else if data.state === 'authorization_expired'}
		<section class="state-card" aria-labelledby="reconnect-title">
			<h2 id="reconnect-title">{m.track_authorization_expired_title()}</h2>
			<p>{m.track_authorization_expired_description()}</p>
			<a href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else}
		<nav class="mix-tabs" aria-label="Mix types">
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === 'daily'}
				onclick={() => (activeTab = 'daily')}
			>
				<span class="tab-indicator tab-blue"></span>
				<Sparkles size={16} />
				<span>{m.mixes_tab_daily()}</span>
			</button>
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === 'discovery'}
				onclick={() => (activeTab = 'discovery')}
			>
				<span class="tab-indicator tab-yellow"></span>
				<Compass size={16} />
				<span>{m.mixes_tab_discovery()}</span>
			</button>
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === 'newRelease'}
				onclick={() => (activeTab = 'newRelease')}
			>
				<span class="tab-indicator tab-red"></span>
				<Flame size={16} />
				<span>{m.mixes_tab_new_release()}</span>
			</button>
		</nav>

		{#if currentMix && currentMix.items.length}
			<article class="mix-showcase">
				<div class="mix-header">
					<div>
						<h2>{currentMix.title}</h2>
						{#if currentMix.subtitle}
							<p class="mix-subtitle">{currentMix.subtitle}</p>
						{/if}
					</div>

					<div class="mix-actions">
						<button
							type="button"
							class="play-mix-btn"
							onclick={() => player.play(currentMix!.items[0], currentMix!.items)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</button>

						<a class="tidal-mix-btn" href={mixTidalUrl} rel="noreferrer" target="_blank">
							{m.mixes_open_in_tidal()}
							<ExternalLink size={13} />
						</a>
					</div>
				</div>

				<div class="song-cards-grid">
					{#each currentMix.items as track, index (track.id)}
						<SongCard {track} contextTracks={currentMix.items} {index} />
					{/each}
				</div>
			</article>
		{:else}
			<section class="state-card" aria-labelledby="empty-mix-title">
				<h2 id="empty-mix-title">{m.mixes_empty_title()}</h2>
				<p>{m.mixes_empty_description()}</p>
			</section>
		{/if}
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.mixes-page {
		max-width: 72rem;
	}

	.mixes-header {
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 1.5rem;
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
		font-size: 1.05rem;
	}

	.mix-tabs {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 2rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}

	.tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 2px solid var(--border-strong);
		background: var(--surface-raised);
		padding: 0.65rem 1.15rem;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		white-space: nowrap;
		position: relative;
		transition: all 0.12s ease;
	}

	.tab-btn:hover {
		color: var(--text-primary);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.tab-btn.active {
		background: var(--surface-selected);
		color: var(--text-primary);
		border-color: var(--action);
		box-shadow: 3px 3px 0px var(--action);
	}

	.tab-indicator {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
	}

	.tab-blue {
		background: var(--bauhaus-blue);
	}
	.tab-yellow {
		background: var(--bauhaus-yellow);
	}
	.tab-red {
		background: var(--bauhaus-red);
	}

	.mix-showcase {
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.mix-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 1rem;
	}

	.mix-header h2 {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.mix-subtitle {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.mix-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.play-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.55rem 1.15rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.play-mix-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.tidal-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		color: var(--text-primary);
		padding: 0.55rem 0.95rem;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.tidal-mix-btn:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
		gap: 1.15rem;
	}

	.state-card {
		margin-top: 2rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.state-card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.state-card p {
		margin: 0;
		color: var(--text-muted);
	}

	.state-card a {
		display: inline-flex;
		margin-top: 1.25rem;
		padding: 0.65rem 1.35rem;
		background: var(--action);
		color: var(--action-contrast);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		font-weight: 700;
		text-transform: uppercase;
		text-decoration: none;
	}

	.attribution {
		margin-top: 3rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}
</style>
