<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { ChevronLeft } from '@lucide/svelte';
	import {
		MOBILE_DETAIL_NAVIGATION,
		mobileScrollKey,
		type MobileDetailNavigation
	} from '#lib/mobile/navigation';

	interface Props {
		/** Where the back control returns to (usually the Now Playing root). */
		backHref: string;
		/** Accessible label for the back control. */
		backLabel: string;
		/** Use the browse scene that opened a catalogue detail, when known. */
		contextualBack?: boolean;
		/** The layered screen's name, rendered as the focus target `<h1>`. */
		heading: string;
		/** Optional single-line context — typically the current track title, truncated. */
		subtitle?: string;
		/** Optional wrapping description line. Ignored when `subtitle` is set. */
		lead?: string;
		/** Wires up an external `aria-labelledby`. */
		headingId?: string;
		/** Controls aligned to the end of the header row (icon buttons). */
		actions?: Snippet;
		/** Tighter spacing below the header, for dense list screens. */
		dense?: boolean;
	}

	let {
		backHref,
		backLabel,
		contextualBack = false,
		heading,
		subtitle,
		lead,
		headingId,
		actions,
		dense = false
	}: Props = $props();
	const detailNavigation = getContext<MobileDetailNavigation | undefined>(MOBILE_DETAIL_NAVIGATION);
	const destination = $derived(
		(contextualBack && detailNavigation?.returnTargets.get(mobileScrollKey(page.url))) || backHref
	);
</script>

<header class="mobile-subscreen-header" class:dense>
	<a class="back" href={destination} aria-label={backLabel}>
		<ChevronLeft size={20} aria-hidden="true" />
	</a>
	<div class="copy">
		<h1 id={headingId}>{heading}</h1>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{:else if lead}
			<p class="lead">{lead}</p>
		{/if}
	</div>
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
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

	.mobile-subscreen-header.dense {
		margin-bottom: 0.5rem;
	}

	.copy {
		min-width: 0;
		flex: 1;
	}

	.actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
		margin-right: -0.5rem;
	}

	h1 {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--fs-lg);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.subtitle {
		margin: 0.15rem 0 0;
		overflow: hidden;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lead {
		margin: 0.2rem 0 0;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		line-height: 1.45;
	}
</style>
