<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ListMusic, Pause, Play, Wand2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { player } from '#lib/player/player.svelte.js';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const nowPlayingArtwork = $derived(
		player.currentTrack?.imageUrl ?? player.currentTrack?.album?.imageUrl
	);
	const savedSets = $derived(customPlaylists.playlists.slice(0, 4));

	/**
	 * With nothing playing and no mix to fall back on, the resume card's own last
	 * branch already asks the listener to generate a set. The standing generation
	 * band below it then repeated the same offer, in a second card treatment, two
	 * rows apart — so the emptiest possible Home was the one that shouted loudest.
	 */
	const resumeIsGenerateInvitation = $derived(!player.currentTrack && !data.dailyMix[0]);
</script>

<svelte:head>
	<title>{m.brand_name()}</title>
	<meta name="description" content={m.home_subtitle()} />
</svelte:head>

<section class="home" aria-labelledby="home-title">
	<ViewHeader
		eyebrow={m.home_eyebrow()}
		title={m.home_title({ name: data.user.name })}
		titleId="home-title"
		description={m.home_subtitle()}
	/>

	{#if data.connection.connected}
		<section
			class:has-artwork={Boolean(nowPlayingArtwork)}
			class="continuation"
			aria-labelledby="continue-title"
		>
			{#if nowPlayingArtwork}
				<img class="continuation-artwork" src={nowPlayingArtwork} alt="" />
			{/if}

			<div class="continuation-copy">
				<p class="eyebrow">
					{resumeIsGenerateInvitation ? m.home_generate_eyebrow() : m.home_resume_eyebrow()}
				</p>
				{#if player.currentTrack}
					<h2 id="continue-title">{player.currentTrack.title}</h2>
					<p>{player.currentTrack.artists.map((artist) => artist.name).join(', ')}</p>
				{:else if data.dailyMix[0]}
					<h2 id="continue-title">{m.home_daily_mix_title()}</h2>
					<p>{m.home_daily_mix_description()}</p>
				{:else}
					<h2 id="continue-title">{m.home_generate_title()}</h2>
					<p>{m.home_generate_description()}</p>
				{/if}
			</div>

			<div class="continuation-action">
				{#if player.currentTrack}
					<Button variant="primary" size="lg" onclick={() => player.togglePlayPause()}>
						{#if player.isPlaying}
							<Pause size={17} fill="currentColor" />
							{m.home_pause_action()}
						{:else}
							<Play size={17} fill="currentColor" />
							{m.home_resume_action()}
						{/if}
					</Button>
				{:else if data.dailyMix[0]}
					<Button
						variant="primary"
						size="lg"
						onclick={() => player.play(data.dailyMix[0], data.dailyMix)}
					>
						<Play size={17} fill="currentColor" />
						{m.player_play_all()}
					</Button>
				{:else}
					<Button href={resolve('/app/generate')} variant="primary" size="lg">
						<Wand2 size={17} />
						{m.home_generate_action()}
					</Button>
				{/if}
			</div>
		</section>

		{#if !resumeIsGenerateInvitation}
			<section class="generation" aria-labelledby="generation-title">
				<div>
					<p class="eyebrow">{m.home_generate_eyebrow()}</p>
					<h2 id="generation-title">{m.home_generate_title()}</h2>
					<p>{m.home_generate_description()}</p>
				</div>
				<Button href={resolve('/app/generate')} variant="secondary">
					<Wand2 size={16} />
					{m.home_generate_action()}
				</Button>
			</section>
		{/if}

		{#if data.dailyMix.length}
			<section class="home-section" aria-labelledby="daily-mix-title">
				<SectionHeader
					eyebrow={m.home_mix_eyebrow()}
					title={m.home_daily_mix_title()}
					titleId="daily-mix-title"
				>
					{#snippet actions()}
						<Button href={resolve('/app/mixes')} variant="ghost" size="sm">
							{m.home_mixes_action()}
							<ArrowRight size={15} />
						</Button>
					{/snippet}
				</SectionHeader>

				<div class="track-grid">
					{#each data.dailyMix as track, index (track.id)}
						<SongCard {track} contextTracks={data.dailyMix} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if savedSets.length}
			<section class="home-section" aria-labelledby="saved-sets-title">
				<SectionHeader
					eyebrow={m.home_saved_sets_eyebrow()}
					title={m.home_saved_sets_title()}
					titleId="saved-sets-title"
				>
					{#snippet actions()}
						<Button href={resolve('/app/generate')} variant="ghost" size="sm">
							{m.home_saved_sets_new()}
						</Button>
					{/snippet}
				</SectionHeader>

				<div class="saved-set-grid">
					{#each savedSets as playlist (playlist.id)}
						<article class="saved-set">
							<div class="saved-set-icon" aria-hidden="true"><ListMusic size={20} /></div>
							<div class="saved-set-copy">
								<h3>{playlist.title}</h3>
								<p>{playlist.items.length} {m.playlist_track_count()}</p>
							</div>
							<button
								type="button"
								class="saved-set-play"
								disabled={playlist.items.length === 0}
								onclick={() => player.play(playlist.items[0], playlist.items)}
								title={m.player_play_all()}
								aria-label={m.player_play_all()}
							>
								<Play size={15} fill="currentColor" />
							</button>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<nav class="shortcuts" aria-label={m.nav_primary()}>
			<a href={resolve('/app/search')}>
				<span>{m.home_search_title()}</span>
				<ArrowRight size={16} />
			</a>
			<a href={resolve('/app/library')}>
				<span>{m.home_library_title()}</span>
				<ArrowRight size={16} />
			</a>
			<a href={resolve('/app/mixes')}>
				<span>{m.mixes_title()}</span>
				<ArrowRight size={16} />
			</a>
		</nav>
	{:else}
		<StateCard
			state="not_connected"
			title={m.home_connect_title()}
			description={m.home_connect_description()}
		/>
	{/if}
</section>

<style>
	.home {
		max-width: var(--content-max);
		margin: 0 auto;
		padding: clamp(0.75rem, 1.5vw, 1.5rem) 0 3rem;
	}

	.continuation h2,
	.generation h2 {
		margin: 0;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.continuation {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.25rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background:
			radial-gradient(
				circle at 92% 12%,
				color-mix(in oklab, var(--action) 12%, transparent),
				transparent 40%
			),
			var(--surface-raised);
		overflow: hidden;
	}

	.continuation.has-artwork {
		grid-template-columns: 5.5rem minmax(0, 1fr) auto;
	}

	.continuation-artwork {
		width: 5.5rem;
		max-width: 5.5rem;
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		box-shadow: 0 0.5rem 1.25rem color-mix(in srgb, var(--ink) 32%, transparent);
		object-fit: cover;
	}

	.continuation-copy {
		min-width: 0;
	}

	.continuation h2 {
		font-size: var(--fs-lg);
		font-weight: 600;
		line-height: 1.15;
	}

	.continuation-copy > p:last-child,
	.generation p {
		margin: 0.25rem 0 0;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}

	.continuation-action {
		align-self: end;
	}

	.generation {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-top: var(--space-section);
		padding: 1rem 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}

	.generation > div {
		max-width: 40rem;
	}

	.generation h2 {
		font-size: var(--fs-md);
		font-weight: 600;
	}

	.home-section {
		margin-top: var(--space-section);
	}

	.shortcuts a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		font-weight: 550;
		text-decoration: none;
		transition: color var(--dur-med) var(--ease-out);
	}

	.shortcuts a:hover {
		color: var(--text-primary);
	}

	.track-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.saved-set-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.saved-set {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}

	.saved-set-icon {
		display: grid;
		width: 2.25rem;
		aspect-ratio: 1;
		place-items: center;
		border-radius: var(--radius-sm);
		background: color-mix(in oklab, var(--action) 12%, var(--surface-canvas));
		color: var(--action);
	}

	.saved-set-copy {
		min-width: 0;
	}

	.saved-set h3,
	.saved-set p {
		margin: 0;
	}

	.saved-set h3 {
		overflow: hidden;
		color: var(--text-primary);
		font-size: var(--fs-sm);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.saved-set p {
		margin-top: 0.15rem;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
	}

	.saved-set-play {
		display: grid;
		width: 2rem;
		aspect-ratio: 1;
		place-items: center;
		border: 0;
		border-radius: var(--radius-full);
		background: var(--text-primary);
		color: var(--surface-canvas);
		cursor: pointer;
		transition:
			scale var(--dur-med) var(--ease-out),
			opacity var(--dur-med) var(--ease-out);
	}

	.saved-set-play:hover:not(:disabled) {
		scale: 1.06;
	}

	.saved-set-play:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}

	.shortcuts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		margin-top: clamp(3rem, 6vw, 5.5rem);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		overflow: hidden;
		background: var(--border-subtle);
	}

	.shortcuts a {
		justify-content: space-between;
		padding: 1.1rem 1.25rem;
		background: var(--surface-raised);
	}

	@media (max-width: 60rem) {
		.track-grid,
		.saved-set-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 42rem) {
		.continuation,
		.continuation.has-artwork {
			grid-template-columns: minmax(0, 1fr);
			gap: 1.25rem;
		}

		.continuation-artwork {
			max-width: 6.5rem;
		}

		.continuation-action {
			align-self: start;
		}

		.generation {
			align-items: start;
			flex-direction: column;
		}

		.track-grid,
		.saved-set-grid,
		.shortcuts {
			grid-template-columns: 1fr;
		}
	}
</style>
