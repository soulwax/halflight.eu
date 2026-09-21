<script lang="ts">
	import { resolve } from '$app/paths';
	import { Library, Search } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { currentPath }: { currentPath: string } = $props();

	const tabs = $derived([
		{ href: resolve('/(mobile)/search'), label: m.now_tab_search(), icon: Search },
		{ href: resolve('/(mobile)/library'), label: m.now_tab_library(), icon: Library }
	]);
</script>

<nav
	class="mobile-tab-bar flex min-w-0 flex-1 items-center justify-around"
	aria-label={m.now_nav_label()}
>
	{#each tabs as tab (tab.href)}
		{@const current = currentPath === tab.href || currentPath.startsWith(`${tab.href}/`)}
		<a
			href={tab.href}
			aria-current={current ? 'page' : undefined}
			aria-label={tab.label}
			title={tab.label}
			class="mobile-tab flex h-10 w-10 items-center justify-center {current
				? 'mobile-tab-current text-(--action)'
				: 'text-(--text-muted)'}"
		>
			<tab.icon size={20} aria-hidden="true" />
		</a>
	{/each}
</nav>

<style>
	.mobile-tab {
		position: relative;
		border-radius: var(--radius-md);
		transition:
			color var(--dur-fast) var(--ease-out),
			background-color var(--dur-fast) var(--ease-out);
	}

	.mobile-tab-current {
		background: color-mix(in oklab, var(--action) 14%, transparent);
	}

	.mobile-tab:focus-visible {
		outline-offset: -2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.mobile-tab {
			transition: none;
		}
	}
</style>
