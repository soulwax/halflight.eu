<script lang="ts">
	import { Compass, ExternalLink, Flame, Play, Sparkles } from '@lucide/svelte';

	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
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
		<p class="deco-eyebrow">SYN // AUTOMATED COMPOSITION</p>
		<h1 id="mixes-title" class="mixes-title">{m.mixes_title()}</h1>
		<p class="intro">{m.mixes_subtitle()}</p>
	</header>

	{#if !data.connected}
		<StateCard
			state="not_connected"
			configured={data.configured}
			title={m.mixes_not_connected_title()}
			description={m.mixes_not_connected_description()}
		/>
	{:else if data.state === 'authorization_expired'}
		<StateCard
			state="authorization_expired"
			configured={data.configured}
			title={m.track_authorization_expired_title()}
			description={m.track_authorization_expired_description()}
		/>
	{:else}
		<nav class="mix-tabs" aria-label={m.mixes_types_label()}>
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
				<SectionHeader title={currentMix.title} subtitle={currentMix.subtitle}>
					{#snippet actions()}
						<Button
							variant="primary"
							onclick={() => player.play(currentMix!.items[0], currentMix!.items)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>

						<Button variant="secondary" href={mixTidalUrl} target="_blank" rel="noreferrer">
							{m.mixes_open_in_tidal()}
							<ExternalLink size={13} />
						</Button>
					{/snippet}
				</SectionHeader>

				<div class="song-cards-grid">
					{#each currentMix.items as track, index (track.id)}
						<SongCard {track} contextTracks={currentMix.items} {index} />
					{/each}
				</div>
			</article>
		{:else}
			<StateCard title={m.mixes_empty_title()} description={m.mixes_empty_description()} />
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
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 1.5rem;
	}

	.mixes-title {
		margin: 0.25rem 0 0.5rem;
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
		color: var(--text-primary);
	}

	.intro {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.mix-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-bottom: 2rem;
	}

	.tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.7rem 1.25rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.tab-btn:hover {
		border-color: var(--border-strong);
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.tab-btn.active {
		border-color: var(--action);
		background: var(--surface-selected);
		color: var(--text-primary);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.tab-indicator {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
	}

	.tab-blue {
		background: var(--bauhaus-blue);
	}
	.tab-yellow {
		background: var(--accent-gold);
	}
	.tab-red {
		background: var(--accent-oxblood);
	}

	.mix-showcase {
		padding: 1.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-raised);
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.15rem;
		margin-top: 1.25rem;
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
