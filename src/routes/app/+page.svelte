<script lang="ts">
	import { resolve } from '$app/paths';
	import { ListPlus, Play } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Syn</title>
	<meta name="description" content={m.home_subtitle()} />
</svelte:head>

<section class="welcome" aria-labelledby="home-title">
	<p class="eyebrow">SYN</p>
	<h1 id="home-title">{m.home_title({ name: data.user.name })}</h1>
	<p class="intro">{m.home_subtitle()}</p>

	{#if data.connection.connected}
		{#if data.dailyMix.length}
			<section class="mix" aria-labelledby="daily-mix-title">
				<div class="section-heading">
					<div>
						<p class="eyebrow">TIDAL</p>
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
				<ol class="track-list">
					{#each data.dailyMix as track, index (track.id)}
						<li>
							<button
								type="button"
								class="track-play-btn"
								onclick={() => player.play(track, data.dailyMix)}
								title={m.player_play_track()}
								aria-label={m.player_play_track()}
							>
								<Play size={13} fill="currentColor" />
							</button>

							<span class="track-number">{String(index + 1).padStart(2, '0')}</span>
							<a href={resolve('/app/tracks/[id]', { id: track.id })}>
								<strong>{track.title}</strong>
								<span>{track.artists.map((artist) => artist.name).join(', ')}</span>
							</a>
							{#if track.duration}<time
									>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(
										2,
										'0'
									)}</time
								>{/if}

							<button
								type="button"
								class="track-queue-btn"
								onclick={() => player.addToQueue(track)}
								title={m.player_add_to_queue()}
								aria-label={m.player_add_to_queue()}
							>
								<ListPlus size={15} />
							</button>
						</li>
					{/each}
				</ol>
				<a class="mix-link" href={resolve('/app/mixes')}>
					{m.home_daily_mix_more()} →
				</a>
			</section>
		{/if}

		<article class="action-card">
			<h2>{m.home_search_title()}</h2>
			<p>{m.home_search_description()}</p>
			<a href={resolve('/app/search')}>{m.home_search_button()}</a>
		</article>
		<article class="action-card">
			<h2>{m.home_library_title()}</h2>
			<p>{m.home_library_description()}</p>
			<a href={resolve('/app/library')}>{m.home_library_button()}</a>
		</article>
		<article class="action-card">
			<h2>{m.mixes_title()}</h2>
			<p>{m.mixes_subtitle()}</p>
			<a href={resolve('/app/mixes')}>{m.nav_mixes()}</a>
		</article>
	{:else}
		<article class="action-card">
			<h2>{m.home_connect_title()}</h2>
			<p>{m.home_connect_description()}</p>
			<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
		</article>
	{/if}
</section>

<style>
	.welcome {
		max-width: 48rem;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.intro {
		margin: 0.75rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.action-card {
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.25rem, 4vw, 2rem);
	}

	.mix {
		margin-bottom: 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		background: var(--surface-raised);
		padding: clamp(1.25rem, 4vw, 2rem);
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.section-heading .eyebrow {
		margin-bottom: 0.4rem;
	}
	.section-heading h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.play-mix-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 0;
		border-radius: 0.5rem;
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.4rem 0.8rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.play-mix-btn:hover {
		opacity: 0.9;
	}

	.track-list {
		margin: 1.5rem 0 1rem;
		padding: 0;
		list-style: none;
	}
	.track-list li {
		display: grid;
		grid-template-columns: 1.8rem 2rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.5rem;
		min-height: 4rem;
		border-top: 1px solid var(--border-subtle);
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

	.track-list a {
		display: grid;
		min-width: 0;
		gap: 0.2rem;
		color: inherit;
		text-decoration: none;
	}
	.track-list a:hover strong,
	.track-list a:focus-visible strong {
		text-decoration: underline;
	}
	.track-list a span,
	.track-list time,
	.track-number {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.track-number {
		font-variant-numeric: tabular-nums;
	}
	.track-list time {
		font-variant-numeric: tabular-nums;
	}
	.mix-link {
		color: var(--text-primary);
		font-weight: 700;
	}

	.action-card + .action-card {
		margin-top: 1rem;
	}

	.action-card h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.action-card p {
		margin: 0.5rem 0 1.25rem;
		color: var(--text-muted);
	}

	.action-card a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font-weight: 700;
		text-decoration: none;
	}

	@media (max-width: 36rem) {
		.section-heading {
			display: block;
		}
		.section-heading p:last-child {
			margin-top: 0.5rem;
			text-align: left;
		}
	}
</style>
