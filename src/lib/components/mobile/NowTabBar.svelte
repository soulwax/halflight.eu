<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Home, Library, Search } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { currentPath }: { currentPath: string } = $props();

	const tabs = $derived([
		{ href: resolve('/(mobile)/home'), label: m.now_tab_home(), icon: Home },
		{ href: resolve('/(mobile)/search'), label: m.now_tab_search(), icon: Search },
		{ href: resolve('/(mobile)/library'), label: m.now_tab_library(), icon: Library },
		{ href: resolve('/(mobile)/now'), label: m.now_tab_now(), icon: Disc }
	]);
</script>

<nav
	class="mobile-tab-bar grid shrink-0 grid-cols-4 border-t border-(--border-subtle) bg-(--surface-raised) pb-[max(0.35rem,env(safe-area-inset-bottom))]"
	aria-label={m.now_nav_label()}
>
	{#each tabs as tab (tab.href)}
		{@const current = currentPath === tab.href || currentPath.startsWith(`${tab.href}/`)}
		<a
			href={tab.href}
			aria-current={current ? 'page' : undefined}
			class="mobile-tab flex min-h-12 flex-col items-center gap-1 py-2 text-xs {current
				? 'mobile-tab-current text-(--action)'
				: 'text-(--text-muted)'}"
		>
			<tab.icon size={20} />
			{tab.label}
		</a>
	{/each}
</nav>

<style>
	.mobile-tab-bar {
		background: color-mix(in oklab, var(--surface-raised) 88%, transparent);
		backdrop-filter: blur(18px) saturate(1.3);
		-webkit-backdrop-filter: blur(18px) saturate(1.3);
	}

	.mobile-tab {
		position: relative;
		margin: 0.25rem 0.2rem 0;
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
		.mobile-tab-bar {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}

		.mobile-tab {
			transition: none;
		}
	}
</style>
