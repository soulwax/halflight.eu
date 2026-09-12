<script lang="ts">
	import type { Snippet } from 'svelte';
	import { qualityTier } from '#lib/format';

	let {
		variant = 'quality',
		text,
		title,
		children
	}: {
		variant?: 'quality' | 'explicit' | 'accent' | 'tag';
		text?: string;
		title?: string;
		children?: Snippet;
	} = $props();

	function formatText(val?: string): string {
		if (!val) return '';
		return val.replaceAll('_', ' ');
	}
</script>

{#if variant === 'explicit'}
	<span class="badge-explicit" title={title ?? 'Explicit'}>
		{#if children}{@render children()}{:else}{text ?? 'E'}{/if}
	</span>
{:else if variant === 'accent'}
	<span class="badge-accent" {title}>
		{#if children}{@render children()}{:else}{formatText(text)}{/if}
	</span>
{:else if variant === 'tag'}
	<!--
		Was previously unhandled and fell through to the `quality` branch below,
		which ran `qualityTier(text)` on whatever text this badge actually holds
		— e.g. a whole confidence sentence at the one real call site
		(taste/+page.svelte's `confidenceLevel === 'high' ? 'accent' : 'tag'`).
		`qualityTier` has no "unrecognised" case, only a `lossy` fallback, so this
		coincidentally rendered in the same muted colour as today — preserved
		exactly (`data-tier="lossy"`) rather than reached by classifying
		non-audio text as if it were one.
	-->
	<span class="badge-quality" data-tier="lossy" {title}>
		{#if children}{@render children()}{:else}{formatText(text)}{/if}
	</span>
{:else}
	<span class="badge-quality" data-tier={qualityTier(text)} {title}>
		{#if children}{@render children()}{:else}{formatText(text)}{/if}
	</span>
{/if}
