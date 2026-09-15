<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The one header a top-level view gets: eyebrow, a single hero line, and an
	 * optional supporting sentence.
	 *
	 * Eight routes used to hand-roll this, and they had drifted into four
	 * different `<h1>` treatments (24px/600 through 56px/800/uppercase) and four
	 * `.eyebrow` forks. `layout.css` already states the intent — `--fs-2xl` is
	 * commented "the one hero line per view, no bigger" — but no route honoured
	 * it. This component is that rule, made reusable.
	 */
	let {
		eyebrow,
		title,
		titleId,
		description,
		mark,
		actions
	}: {
		eyebrow?: string;
		title: string;
		titleId?: string;
		description?: string;
		/** A small leading icon. Decorative — the title carries the meaning. */
		mark?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<header class="view-header">
	{#if mark}
		<div class="view-header-mark" aria-hidden="true">{@render mark()}</div>
	{/if}

	<div class="view-header-text">
		{#if eyebrow}
			<p class="eyebrow">{eyebrow}</p>
		{/if}
		<h1 id={titleId} class="view-header-title">{title}</h1>
		{#if description}
			<p class="view-header-description">{description}</p>
		{/if}
	</div>

	{#if actions}
		<div class="view-header-actions">{@render actions()}</div>
	{/if}
</header>

<style>
	.view-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin-bottom: var(--space-section);
		padding-bottom: 1.5rem;
		border-bottom: var(--hairline);
	}

	.view-header-mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-md);
		border: var(--hairline);
		background: color-mix(in oklab, var(--sky) 45%, var(--surface-raised));
		color: var(--action);
	}

	.view-header-text {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1 1 20rem;
		min-width: 0;
	}

	/* font-family/weight/letter-spacing/transform are deliberately not set
	   here: this is a real <h1>, so it already inherits the active theme's
	   heading identity from layout.css's shared h1,h2,h3 rule (--font-heading,
	   --heading-weight, --heading-tracking, --heading-transform) — Electric's
	   monospace readout, Light's editorial serif. Redeclaring any of them
	   here would silently pin every theme to one look on the single most
	   visible heading in the app. */
	.view-header-title {
		margin: 0;
		font-size: var(--fs-2xl);
		line-height: 1.15;
		color: var(--text-primary);
		text-wrap: balance;
	}

	.view-header-description {
		margin: 0;
		max-width: 46rem;
		font-size: var(--fs-base);
		line-height: 1.55;
		color: var(--text-muted);
	}

	.view-header-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin-left: auto;
	}
</style>
