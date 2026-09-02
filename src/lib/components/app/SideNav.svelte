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
		signOutAction?: string;
		signOutLabel?: string;
	}

	let {
		brand,
		navigation,
		currentPath,
		navigationLabel,
		userName,
		accountHref,
		accountLabel,
		signOutAction,
		signOutLabel
	}: Props = $props();
</script>

<aside
	class="hidden w-64 shrink-0 border-r-2 border-[var(--border-subtle)] bg-[var(--surface-raised)] md:flex md:flex-col"
>
	<div
		class="flex min-h-18 items-center justify-between border-b-2 border-[var(--border-subtle)] px-6"
	>
		<a
			class="flex items-center gap-2 text-xl font-extrabold tracking-tighter uppercase"
			href={brand.href}
		>
			<span class="inline-block h-3 w-3 bg-[var(--action)]"></span>
			{brand.label}
		</a>
		<span class="font-mono text-xs font-bold tracking-widest text-[var(--text-muted)]">01</span>
	</div>

	<nav class="p-3" aria-label={navigationLabel}>
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
		<div class="mt-auto border-t-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4">
			{#if accountHref && accountLabel}
				<a class="app-account-link" href={accountHref}>
					{#if userName}<span class="truncate font-bold">{userName}</span>{/if}
					<span class="text-xs tracking-wider text-[var(--text-muted)] uppercase"
						>{accountLabel}</span
					>
				</a>
			{:else if userName}
				<p class="truncate text-xs tracking-wider text-[var(--text-muted)] uppercase">{userName}</p>
			{/if}
			{#if signOutAction && signOutLabel}
				<form method="POST" action={signOutAction} class="mt-2">
					<button
						class="app-account-link w-full cursor-pointer text-left hover:border-[var(--danger)] hover:text-[var(--danger)]"
						type="submit"
					>
						<span class="text-xs font-bold tracking-wider uppercase">{signOutLabel}</span>
					</button>
				</form>
			{/if}
		</div>
	{/if}
</aside>
