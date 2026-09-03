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
		class: className = '',
		children
	}: {
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		title?: string;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
		target?: string;
		rel?: string;
		class?: string;
		children?: Snippet;
	} = $props();

	const variantClass = $derived(
		variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : ''
	);

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
