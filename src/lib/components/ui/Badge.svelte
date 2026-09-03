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
{:else}
	<span class="badge-quality" data-tier={qualityTier(text)} {title}>
		{#if children}{@render children()}{:else}{formatText(text)}{/if}
	</span>
{/if}
