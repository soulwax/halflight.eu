<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Home, Library, Search } from '@lucide/svelte';
	import { deLocalizeHref } from '#lib/paraglide/runtime';
	import { m } from '#lib/paraglide/messages.js';

	let { currentPath }: { currentPath: string } = $props();

	const tabs = $derived([
		{ href: resolve('/(mobile)/home'), label: m.now_tab_home(), icon: Home },
		{ href: resolve('/(mobile)/search'), label: m.now_tab_search(), icon: Search },
		{ href: resolve('/(mobile)/library'), label: m.now_tab_library(), icon: Library },
		{ href: resolve('/(mobile)/now'), label: m.now_tab_now(), icon: Disc }
	]);
</script>

<nav class="mobile-tab-bar flex min-w-0 items-center justify-around" aria-label={m.now_nav_label()}>
	{#each tabs as tab (tab.href)}
		{@const path = deLocalizeHref(currentPath)}
		{@const current = path === tab.href || path.startsWith(`${tab.href}/`)}
		<a
			href={tab.href}
			aria-current={current ? 'page' : undefined}
			aria-label={tab.label}
			title={tab.label}
			class="mobile-tab {current ? 'mobile-tab-current text-(--action)' : 'text-(--text-muted)'}"
		>
			<tab.icon size={20} aria-hidden="true" />
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.mobile-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		min-width: 0;
		min-height: 3.5rem;
		flex: 1;
		padding: 0.4rem 0.15rem;
		text-decoration: none;
		font-size: var(--fs-xs);
		text-align: center;
		overflow-wrap: anywhere;
		position: relative;
		border-radius: var(--radius-md);
		transition:
			color var(--dur-fast) var(--ease-out),
			background-color var(--dur-fast) var(--ease-out);
	}

	.mobile-tab-current {
		background: color-mix(in oklab, var(--action) 14%, transparent);
	}
	.mobile-tab-current span {
		font-weight: 700;
	}
	.mobile-tab-bar {
		padding-bottom: env(safe-area-inset-bottom);
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		flex-shrink: 0;
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
