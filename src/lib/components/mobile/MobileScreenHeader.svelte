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
	}

	let { heading, lead, kicker, headingId }: Props = $props();
</script>

<header class="mobile-screen-header">
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
		position: relative;
		padding-bottom: clamp(1.1rem, 5vw, 1.6rem);
		margin-bottom: clamp(1.25rem, 5vw, 1.75rem);
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
		font-size: clamp(1.7rem, 8vw, 2.4rem);
		font-weight: 700;
		letter-spacing: -0.045em;
		line-height: 1;
	}

	.kicker + h1 {
		margin-top: 0.34rem;
	}

	.lead {
		max-width: 34ch;
		margin: 0.55rem 0 0;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.5;
	}
</style>
