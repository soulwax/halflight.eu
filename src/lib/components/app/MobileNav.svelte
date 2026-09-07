<script lang="ts">
	import type { AppNavigationItem } from './navigation.js';
	import { isCurrentNavigationItem } from './navigation.js';

	interface Props {
		navigation: AppNavigationItem[];
		currentPath: string;
		navigationLabel: string;
		signOutAction?: string;
		signOutLabel?: string;
	}

	let { navigation, currentPath, navigationLabel, signOutAction, signOutLabel }: Props = $props();
</script>

<nav
	class="mobile-listening-room-nav shrink-0 border-t-2 border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
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
		{#if signOutAction && signOutLabel}
			<li class="min-w-20">
				<form method="POST" action={signOutAction}>
					<button class="app-mobile-nav-link w-full cursor-pointer" type="submit"
						>{signOutLabel}</button
					>
				</form>
			</li>
		{/if}
	</ul>
</nav>
