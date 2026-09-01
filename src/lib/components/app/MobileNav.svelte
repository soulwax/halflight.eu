<script lang="ts">
	import type { AppNavigationItem } from './navigation.js';
	import { isCurrentNavigationItem } from './navigation.js';

	interface Props {
		navigation: AppNavigationItem[];
		currentPath: string;
		navigationLabel: string;
	}

	let { navigation, currentPath, navigationLabel }: Props = $props();
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[color:var(--surface-raised)/0.96] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
	aria-label={navigationLabel}
>
	<ul class="grid auto-cols-fr grid-flow-col overflow-x-auto">
		{#each navigation as item (item.href)}
			{@const current = isCurrentNavigationItem(item, currentPath)}
			<li class="min-w-20">
				<a
					href={item.href}
					aria-current={current ? 'page' : undefined}
					class:app-mobile-nav-link-current={current}
					class="app-mobile-nav-link"
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
