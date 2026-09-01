<script lang="ts">
	import type { AppBrand, AppNavigationItem } from './navigation.js';
	import { isCurrentNavigationItem } from './navigation.js';

	interface Props {
		brand: AppBrand;
		navigation: AppNavigationItem[];
		currentPath: string;
		navigationLabel: string;
		userName?: string;
		accountHref?: string;
		accountLabel?: string;
	}

	let {
		brand,
		navigation,
		currentPath,
		navigationLabel,
		userName,
		accountHref,
		accountLabel
	}: Props = $props();
</script>

<aside
	class="hidden w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-raised)] md:flex md:flex-col"
>
	<a class="flex min-h-16 items-center px-6 text-xl font-semibold tracking-tight" href={brand.href}>
		{brand.label}
	</a>

	<nav class="px-3 py-4" aria-label={navigationLabel}>
		<ul class="space-y-1">
			{#each navigation as item (item.href)}
				{@const current = isCurrentNavigationItem(item, currentPath)}
				<li>
					<a
						href={item.href}
						aria-current={current ? 'page' : undefined}
						class:app-nav-link-current={current}
						class="app-nav-link"
					>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	{#if userName || (accountHref && accountLabel)}
		<div class="mt-auto border-t border-[var(--border-subtle)] p-4">
			{#if accountHref && accountLabel}
				<a class="app-account-link" href={accountHref}>
					{#if userName}<span class="truncate">{userName}</span>{/if}
					<span class="text-sm text-[var(--text-muted)]">{accountLabel}</span>
				</a>
			{:else if userName}
				<p class="truncate text-sm text-[var(--text-muted)]">{userName}</p>
			{/if}
		</div>
	{/if}
</aside>
