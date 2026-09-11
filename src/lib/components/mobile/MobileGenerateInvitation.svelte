<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Sparkles } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<section class="mobile-generate-invitation" aria-labelledby="mobile-generate-invitation-title">
	<div class="mobile-generate-icon" aria-hidden="true"><Sparkles size={19} /></div>
	<div class="mobile-generate-copy">
		<p class="mobile-generate-kicker">{m.home_generate_eyebrow()}</p>
		<h2 id="mobile-generate-invitation-title">{m.home_generate_title()}</h2>
		<p>{m.home_generate_description()}</p>
	</div>
	<a href={resolve('/(mobile)/generate')} class="mobile-generate-action">
		<span>{m.home_generate_action()}</span>
		<ArrowUpRight size={17} aria-hidden="true" />
	</a>
</section>

<style>
	.mobile-generate-invitation {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.85rem;
		align-items: start;
		margin-top: clamp(1.15rem, 5vw, 1.75rem);
		padding: clamp(1rem, 4vw, 1.35rem);
		border: 1px solid color-mix(in oklab, var(--action) 28%, var(--border-subtle));
		border-radius: var(--radius-lg);
		background:
			linear-gradient(
				130deg,
				color-mix(in oklab, var(--action) 12%, var(--surface-raised)),
				var(--surface-raised)
			),
			var(--surface-raised);
		box-shadow: var(--shadow-panel);
	}

	.mobile-generate-icon {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		color: var(--action-contrast);
		border-radius: var(--radius-md);
		background: var(--action);
	}

	.mobile-generate-copy h2,
	.mobile-generate-copy p {
		margin: 0;
	}

	.mobile-generate-kicker {
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.mobile-generate-copy h2 {
		margin-top: 0.18rem;
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		letter-spacing: -0.03em;
	}

	.mobile-generate-copy > p:last-child {
		margin-top: 0.42rem;
		color: var(--text-muted);
		font-size: var(--fs-xs);
		line-height: 1.45;
	}

	.mobile-generate-action {
		display: inline-flex;
		grid-column: 2;
		gap: 0.3rem;
		align-items: center;
		min-height: 2.75rem;
		margin-top: -0.15rem;
		color: var(--text-primary);
		font-size: var(--fs-xs);
		font-weight: 700;
		text-decoration: none;
	}

	.mobile-generate-action:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
</style>
