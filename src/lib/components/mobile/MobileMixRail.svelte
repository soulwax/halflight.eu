<script lang="ts">
	import { Disc, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let { tracks }: { tracks: TrackSummary[] } = $props();
</script>

{#if tracks.length > 0}
	<section class="mix-rail" aria-labelledby="mix-rail-heading">
		<p id="mix-rail-heading" class="section-label">{m.now_home_mix_heading()}</p>
		<ul class="rail-strip">
			{#each tracks as track (track.id)}
				{@const cover = track.imageUrl ?? track.album?.imageUrl ?? null}
				<li>
					<button type="button" class="rail-item" onclick={() => player.play(track, tracks)}>
						<span class="rail-art">
							{#if cover}
								<img src={cover} alt="" loading="lazy" />
							{:else}
								<Disc size={26} strokeWidth={1.4} aria-hidden="true" />
							{/if}
							<span class="rail-play" aria-hidden="true"
								><Play size={16} fill="currentColor" /></span
							>
						</span>
						<span class="rail-title">{track.title}</span>
						{#if track.artists.length}
							<span class="rail-artist">{track.artists.map((a) => a.name).join(', ')}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.mix-rail {
		padding-top: clamp(1rem, 5vw, 1.75rem);
	}

	.section-label {
		margin: 0 0 0.7rem;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.rail-strip {
		display: flex;
		gap: 0.75rem;
		margin: 0;
		padding: 0 0 0.25rem;
		list-style: none;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.rail-strip::-webkit-scrollbar {
		display: none;
	}

	.rail-item {
		display: flex;
		flex-direction: column;
		width: 6.75rem;
		flex: none;
		gap: 0.4rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		scroll-snap-align: start;
	}

	.rail-art {
		position: relative;
		display: grid;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-selected);
	}

	.rail-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.rail-play {
		position: absolute;
		right: 0.35rem;
		bottom: 0.35rem;
		display: grid;
		width: 1.65rem;
		height: 1.65rem;
		place-items: center;
		color: var(--action-contrast);
		border-radius: var(--radius-full);
		background: var(--action);
		opacity: 0;
		transition: opacity var(--dur-fast) var(--ease-out);
	}

	.rail-item:hover .rail-play,
	.rail-item:focus-visible .rail-play {
		opacity: 1;
	}

	.rail-item:focus-visible {
		outline: none;
	}

	.rail-item:focus-visible .rail-art {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.rail-title,
	.rail-artist {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.rail-title {
		color: var(--text-primary);
		font-size: var(--fs-xs);
		font-weight: 600;
		line-height: 1.25;
	}

	.rail-artist {
		-webkit-line-clamp: 1;
		line-clamp: 1;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		line-height: 1.25;
	}

	@media (prefers-reduced-motion: reduce) {
		.rail-play {
			transition: none;
		}
	}
</style>
