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
	<header>
		<p class="eyebrow">TIDAL</p>
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
				class:active={activeTab === 'daily'}
				onclick={() => (activeTab = 'daily')}
			>
				<Sparkles size={18} />
				<span>{m.mixes_tab_daily()}</span>
			</button>
			<button
				type="button"
				class:active={activeTab === 'discovery'}
				onclick={() => (activeTab = 'discovery')}
			>
				<Compass size={18} />
				<span>{m.mixes_tab_discovery()}</span>
			</button>
			<button
				type="button"
				class:active={activeTab === 'newRelease'}
				onclick={() => (activeTab = 'newRelease')}
			>
				<Flame size={18} />
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
							<Play size={15} fill="currentColor" />
							{m.player_play_all()}
						</button>

						<a class="tidal-mix-btn" href={mixTidalUrl} rel="noreferrer" target="_blank">
							{m.mixes_open_in_tidal()}
							<ExternalLink size={14} />
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

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.intro {
		margin: 0.75rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.mix-tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.75rem;
		margin-bottom: 1.5rem;
		overflow-x: auto;
	}

	.mix-tabs button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: 9999px;
		background: var(--surface-raised);
		padding: 0.6rem 1.15rem;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.mix-tabs button:hover {
		color: var(--text-primary);
		border-color: var(--border-strong);
	}

	.mix-tabs button.active {
		background: var(--action);
		border-color: var(--action);
		color: var(--action-contrast);
	}

	.mix-showcase {
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.75rem);
	}

	.mix-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 1rem;
	}

	.mix-header h2 {
		margin-bottom: 0.25rem;
		font-size: 1.35rem;
	}

	.mix-subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.mix-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.play-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		border-radius: 0.65rem;
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.5rem 0.9rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.play-mix-btn:hover {
		opacity: 0.9;
	}

	.tidal-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border-radius: 0.65rem;
		background: var(--surface-selected);
		border: 1px solid var(--border-subtle);
		padding: 0.5rem 0.85rem;
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
	}

	.tidal-mix-btn:hover {
		border-color: var(--border-strong);
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.track-list li {
		display: grid;
		grid-template-columns: 2rem 1.8rem minmax(0, 1.5fr) minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 0.5rem;
		min-height: 3.25rem;
		border-top: 1px solid var(--border-subtle);
		padding: 0.4rem 0;
	}

	.track-play-btn,
	.track-queue-btn {
		display: grid;
		place-items: center;
		width: 1.85rem;
		height: 1.85rem;
		border: 0;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		transition: all 0.15s ease;
	}

	.track-play-btn:hover {
		color: var(--action);
		background: var(--surface-selected);
	}

	.track-queue-btn:hover {
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.track-list li:first-child {
		border-top: 0;
	}

	.track-num {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		padding-right: 0.25rem;
	}

	.track-main {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}

	.track-link {
		color: inherit;
		text-decoration: none;
	}

	.track-link:hover strong,
	.track-link:focus-visible strong {
		text-decoration: underline;
	}

	.track-artists,
	.track-album {
		color: var(--text-muted);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-artists a,
	.track-album a {
		color: inherit;
		text-decoration: none;
	}

	.track-artists a:hover,
	.track-artists a:focus-visible,
	.track-album a:hover,
	.track-album a:focus-visible {
		text-decoration: underline;
	}

	.explicit-badge {
		border-radius: 0.25rem;
		background: var(--surface-selected);
		padding: 0.1rem 0.35rem;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 700;
	}

	.track-time {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.state-card {
		margin-top: 1.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.state-card p {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.state-card a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font-weight: 700;
		text-decoration: none;
	}

	.attribution {
		margin-top: 2rem;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.attribution a {
		color: inherit;
	}

	@media (max-width: 42rem) {
		.track-list li {
			grid-template-columns: 2rem minmax(0, 1fr) auto auto;
		}
		.track-album {
			display: none;
		}
	}
</style>
