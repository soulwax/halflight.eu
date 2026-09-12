<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href,
		type = 'button',
		variant = 'secondary',
		size = 'md',
		disabled = false,
		title,
		ariaLabel,
		onclick,
		target,
		rel,
		download,
		class: className = '',
		children
	}: {
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		// 'secondary' is `.btn-base` on its own — the bordered default. 'ghost'
		// drops the border and fill so it can sit next to a secondary button
		// without competing with it.
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		title?: string;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
		target?: string;
		rel?: string;
		/** Link-only: the filename a downloadable href should save as. */
		download?: string;
		class?: string;
		children?: Snippet;
	} = $props();

	const VARIANT_CLASS = {
		primary: 'btn-primary',
		secondary: '',
		danger: 'btn-danger',
		ghost: 'btn-ghost'
	} as const;

	const variantClass = $derived(VARIANT_CLASS[variant]);

	const sizeClass = $derived(size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '');
</script>

{#if href}
	<a
		{href}
		class="btn-base {variantClass} {sizeClass} {className}"
		{title}
		aria-label={ariaLabel}
		{target}
		{rel}
		{download}
		{onclick}
	>
		{#if children}{@render children()}{/if}
	</a>
{:else}
	<button
		{type}
		class="btn-base {variantClass} {sizeClass} {className}"
		{disabled}
		{title}
		aria-label={ariaLabel}
		{onclick}
	>
		{#if children}{@render children()}{/if}
	</button>
{/if}
