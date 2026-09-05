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
	class="grid shrink-0 grid-cols-4 border-t border-(--border-subtle) bg-(--surface-raised) pb-[max(0.25rem,env(safe-area-inset-bottom))]"
	aria-label={m.now_nav_label()}
>
	{#each tabs as tab (tab.href)}
		{@const current = currentPath === tab.href || currentPath.startsWith(`${tab.href}/`)}
		<a
			href={tab.href}
			aria-current={current ? 'page' : undefined}
			class="flex min-h-12 flex-col items-center gap-1 py-2 text-xs {current
				? 'text-(--action)'
				: 'text-(--text-muted)'}"
		>
			<tab.icon size={20} />
			{tab.label}
		</a>
	{/each}
</nav>
