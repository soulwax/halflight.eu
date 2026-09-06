<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Disc, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';

	const track = $derived(player.currentTrack);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');
</script>

<section class="mobile-home">
	<header class="home-masthead">
		<p class="home-kicker">{m.brand_name()}</p>
		<h1>{m.now_home_heading()}</h1>
	</header>

	{#if track}
		<section class="resume-section" aria-labelledby="continue-listening-heading">
			<p id="continue-listening-heading" class="section-label">
				{m.now_home_continue_heading()}
			</p>
			<a
				href={resolve('/(mobile)/now')}
				aria-label={m.now_home_resume_cta()}
				class="resume-feature"
			>
				<span class="resume-art">
					{#if cover}
						<img src={cover} alt="" class="h-full w-full object-cover" />
					{:else}
						<Disc size={30} strokeWidth={1.5} aria-hidden="true" />
					{/if}
				</span>
				<span class="resume-copy">
					<span class="resume-title">{track.title}</span>
					{#if artistLine}
						<span class="resume-artist">{artistLine}</span>
					{/if}
					<span class="resume-action">
						{m.now_home_resume_cta()}
						<span class="resume-action-icon" aria-hidden="true">
							<Play size={13} fill="currentColor" />
						</span>
					</span>
				</span>
				<span class="resume-arrow" aria-hidden="true"
					><ArrowUpRight size={18} strokeWidth={1.6} /></span
				>
			</a>
		</section>
	{:else}
		<section class="empty-state" aria-label={m.now_home_continue_heading()}>
			<span class="empty-disc" aria-hidden="true"><Disc size={26} strokeWidth={1.4} /></span>
			<p>{m.now_home_empty()}</p>
		</section>
	{/if}
</section>

<style>
	.mobile-home {
		min-height: 100%;
		padding: clamp(1.5rem, 6vw, 2.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 9vw, 4rem);
	}

	.home-masthead {
		position: relative;
		padding: 0 0 clamp(1.75rem, 7vw, 2.75rem);
	}

	.home-masthead::after {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 1px;
		content: '';
		background: linear-gradient(
			90deg,
			var(--border-subtle),
			color-mix(in oklab, var(--editorial-sky, var(--action)) 72%, var(--border-subtle)),
			transparent
		);
	}

	.home-kicker,
	.section-label {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.12em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.home-masthead h1 {
		margin: 0.38rem 0 0;
		color: var(--text-primary);
		font-family: var(--font-display);
		font-size: clamp(2rem, 10vw, 3rem);
		font-weight: 700;
		letter-spacing: -0.055em;
		line-height: 0.92;
	}

	.resume-section {
		padding-top: clamp(1.4rem, 5vw, 2rem);
	}

	.section-label {
		margin-bottom: 0.65rem;
	}

	.resume-feature {
		display: grid;
		grid-template-columns: minmax(5.85rem, 29vw) minmax(0, 1fr) auto;
		gap: clamp(0.85rem, 4vw, 1.25rem);
		align-items: center;
		min-height: 9rem;
		padding: 0.625rem;
		color: inherit;
		text-decoration: none;
		border: 1px solid color-mix(in oklab, var(--border-subtle) 84%, transparent);
		border-radius: var(--radius-lg);
		background:
			linear-gradient(
				122deg,
				color-mix(
					in oklab,
					var(--editorial-sky, var(--surface-selected)) 48%,
					var(--surface-raised)
				),
				color-mix(
					in oklab,
					var(--editorial-blush, var(--surface-raised)) 24%,
					var(--surface-raised)
				)
			),
			var(--surface-raised);
		box-shadow: 0 12px 28px -23px color-mix(in srgb, var(--text-primary) 42%, transparent);
		transition:
			transform var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out),
			border-color var(--dur-fast) var(--ease-out);
	}

	.resume-feature:hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--action) 36%, var(--border-subtle));
		box-shadow: 0 18px 32px -23px color-mix(in srgb, var(--text-primary) 54%, transparent);
	}

	.resume-feature:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.resume-art {
		display: grid;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		color: var(--text-muted);
		border-radius: calc(var(--radius-lg) - 0.25rem);
		background: color-mix(in oklab, var(--surface-raised) 48%, var(--surface-canvas));
		box-shadow: 0 10px 22px -16px color-mix(in srgb, var(--text-primary) 54%, transparent);
	}

	.resume-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
	}

	.resume-title,
	.resume-artist {
		display: block;
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.resume-title {
		color: var(--text-primary);
		font-size: var(--fs-md);
		font-weight: 700;
		letter-spacing: -0.025em;
		line-height: 1.18;
	}

	.resume-artist {
		margin-top: 0.28rem;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.35;
	}

	.resume-action {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		margin-top: 1rem;
		color: var(--text-primary);
		font-size: var(--fs-xs);
		font-weight: 700;
		line-height: 1;
	}

	.resume-action-icon {
		display: grid;
		width: 1.45rem;
		height: 1.45rem;
		place-items: center;
		color: var(--action-contrast);
		border-radius: var(--radius-full);
		background: var(--action);
	}

	.resume-arrow {
		align-self: start;
		margin-top: 0.2rem;
		color: var(--text-muted);
	}

	.empty-state {
		display: grid;
		justify-items: start;
		gap: 1rem;
		margin-top: clamp(1.5rem, 6vw, 2.5rem);
		padding: clamp(1.4rem, 6vw, 2rem);
		color: var(--text-muted);
		border: 1px solid color-mix(in oklab, var(--border-subtle) 78%, transparent);
		border-radius: var(--radius-lg);
		background: color-mix(in oklab, var(--surface-raised) 78%, transparent);
	}

	.empty-state p {
		max-width: 24rem;
		margin: 0;
		font-size: var(--fs-sm);
		line-height: 1.55;
	}

	.empty-disc {
		display: grid;
		width: 3rem;
		height: 3rem;
		place-items: center;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: color-mix(in oklab, var(--editorial-sky, var(--surface-selected)) 42%, transparent);
	}

	@media (min-width: 30rem) {
		.resume-feature {
			grid-template-columns: 7.5rem minmax(0, 1fr) auto;
			min-height: 10rem;
			padding: 0.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.resume-feature {
			transition: none;
		}

		.resume-feature:hover {
			transform: none;
		}
	}
</style>
