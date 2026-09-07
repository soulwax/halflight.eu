<script lang="ts">
	import { ChevronLeft } from '@lucide/svelte';

	interface Props {
		/** Where the back control returns to (usually the Now Playing root). */
		backHref: string;
		/** Accessible label for the back control. */
		backLabel: string;
		/** The layered screen's name, rendered as the focus target `<h1>`. */
		heading: string;
		/** Optional context line — typically the current track title. */
		subtitle?: string;
		/** Wires up an external `aria-labelledby`. */
		headingId?: string;
	}

	let { backHref, backLabel, heading, subtitle, headingId }: Props = $props();
</script>

<header class="mobile-subscreen-header">
	<a class="back" href={backHref} aria-label={backLabel}>
		<ChevronLeft size={20} aria-hidden="true" />
	</a>
	<div class="copy">
		<h1 id={headingId}>{heading}</h1>
		{#if subtitle}
			<p>{subtitle}</p>
		{/if}
	</div>
</header>

<style>
	.mobile-subscreen-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: clamp(1.25rem, 6vw, 2rem);
	}

	.back {
		display: grid;
		flex: none;
		width: 3rem;
		height: 3rem;
		place-items: center;
		margin-left: -0.6rem;
		color: var(--text-primary);
		border-radius: var(--radius-full);
	}

	.back:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -3px;
	}

	.copy {
		min-width: 0;
	}

	h1 {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--fs-lg);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	p {
		margin: 0.15rem 0 0;
		overflow: hidden;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
