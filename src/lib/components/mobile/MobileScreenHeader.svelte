<script lang="ts">
	interface Props {
		/** The screen name, rendered as the focus target `<h1>`. */
		heading: string;
		/** Optional short line under the heading. */
		lead?: string;
		/** Optional overline label above the heading. */
		kicker?: string;
		/** Wires up an external `aria-labelledby`. */
		headingId?: string;
		/**
		 * `screen` is the interior default. `masthead` is the larger front-door
		 * scale Home uses, and leaves the gap below the rule to the next section.
		 */
		tone?: 'screen' | 'masthead';
	}

	let { heading, lead, kicker, headingId, tone = 'screen' }: Props = $props();
</script>

<header class="mobile-screen-header" data-tone={tone}>
	{#if kicker}
		<p class="kicker">{kicker}</p>
	{/if}
	<h1 id={headingId}>{heading}</h1>
	{#if lead}
		<p class="lead">{lead}</p>
	{/if}
</header>

<style>
	.mobile-screen-header {
		--header-pad: clamp(1.1rem, 5vw, 1.6rem);
		--header-gap: clamp(1.25rem, 5vw, 1.75rem);
		--header-size: clamp(1.7rem, 8vw, 2.4rem);
		--header-tracking: -0.045em;
		--header-leading: 1;
		--header-kicker-gap: 0.34rem;

		position: relative;
		padding-bottom: var(--header-pad);
		margin-bottom: var(--header-gap);
	}

	.mobile-screen-header[data-tone='masthead'] {
		--header-pad: clamp(1.75rem, 7vw, 2.75rem);
		--header-gap: 0;
		--header-size: clamp(2rem, 10vw, 3rem);
		--header-tracking: -0.055em;
		--header-leading: 0.92;
		--header-kicker-gap: 0.38rem;
	}

	.mobile-screen-header::after {
		position: absolute;
		inset: auto 0 0;
		height: 1px;
		content: '';
		background: linear-gradient(
			90deg,
			var(--border-subtle),
			color-mix(in oklab, var(--editorial-sky, var(--action)) 58%, var(--border-subtle)),
			transparent
		);
	}

	.mobile-screen-header[data-tone='masthead']::after {
		background: linear-gradient(
			90deg,
			var(--border-subtle),
			color-mix(in oklab, var(--editorial-sky, var(--action)) 72%, var(--border-subtle)),
			transparent
		);
	}

	.kicker {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.12em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.3rem 0 0;
		color: var(--text-primary);
		font-family: var(--font-display);
		font-size: var(--header-size);
		font-weight: 700;
		letter-spacing: var(--header-tracking);
		line-height: var(--header-leading);
	}

	.kicker + h1 {
		margin-top: var(--header-kicker-gap);
	}

	.lead {
		max-width: 34ch;
		margin: 0.55rem 0 0;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
</style>
