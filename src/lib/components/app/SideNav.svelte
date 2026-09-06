<script lang="ts">
	import type { AppNavigationItem } from './navigation.js';
	import { isCurrentNavigationItem } from './navigation.js';

	interface Props {
		navigation: AppNavigationItem[];
		currentPath: string;
		navigationLabel: string;
		userName?: string;
		accountHref?: string;
		accountLabel?: string;
		signOutAction?: string;
		signOutLabel?: string;
		collapsed?: boolean;
		onToggleRail?: () => void;
		collapseRailLabel?: string;
		expandRailLabel?: string;
	}

	let {
		navigation,
		currentPath,
		navigationLabel,
		userName,
		accountHref,
		accountLabel,
		signOutAction,
		signOutLabel,
		collapsed = false,
		onToggleRail,
		collapseRailLabel,
		expandRailLabel
	}: Props = $props();
</script>

<aside
	class:side-nav-collapsed={collapsed}
	class="side-nav relative hidden h-full w-full shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-raised)] md:flex md:flex-col"
>
	<span
		class="pointer-events-none absolute inset-y-0 right-[3px] w-px bg-[color-mix(in_oklab,var(--accent-gold)_28%,transparent)]"
	></span>

	{#if onToggleRail && collapseRailLabel && expandRailLabel}
		<div class="flex justify-end px-3 pt-3">
			<button
				type="button"
				class="rail-toggle"
				onclick={onToggleRail}
				aria-label={collapsed ? expandRailLabel : collapseRailLabel}
				title={collapsed ? expandRailLabel : collapseRailLabel}
			>
				<span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
			</button>
		</div>
	{/if}

	<nav class="side-nav-links px-3 pt-3 pb-5" aria-label={navigationLabel}>
		<ul class="space-y-0.5">
			{#each navigation as item (item.href)}
				{@const current = isCurrentNavigationItem(item, currentPath)}
				<li>
					<a
						href={item.href}
						aria-current={current ? 'page' : undefined}
						class:app-nav-link-current={current}
						class="app-nav-link"
						title={collapsed ? item.label : undefined}
					>
						{#if item.icon}
							<item.icon size={17} aria-hidden="true" />
						{:else}
							<span class="nav-monogram" aria-hidden="true">{item.label.slice(0, 1)}</span>
						{/if}
						<span class="side-nav-label">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div
		class="side-nav-account mt-auto border-t-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4"
	>
		{#if accountHref && accountLabel}
			<a class="app-account-link" href={accountHref}>
				{#if userName}<span class="side-nav-label truncate font-bold">{userName}</span>{/if}
				<span class="side-nav-label text-xs tracking-wider text-[var(--text-muted)] uppercase"
					>{accountLabel}</span
				>
			</a>
		{:else if userName}
			<p class="side-nav-label truncate text-xs tracking-wider text-[var(--text-muted)] uppercase">
				{userName}
			</p>
		{/if}
		{#if signOutAction && signOutLabel}
			<form method="POST" action={signOutAction} class="mt-2">
				<button
					class="app-account-link w-full cursor-pointer text-left hover:border-[var(--danger)] hover:text-[var(--danger)]"
					type="submit"
				>
					<span class="side-nav-label text-xs font-bold tracking-wider uppercase"
						>{signOutLabel}</span
					>
				</button>
			</form>
		{/if}
	</div>
</aside>

<style>
	/* Expanded rail: label carries the item. The monogram is only a fallback for
	   an item without an icon, and only in the collapsed rail. */
	.nav-monogram {
		display: none;
	}

	.rail-toggle {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: var(--hairline);
		background: var(--surface-canvas);
		color: var(--text-muted);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
	}
	.rail-toggle:hover,
	.rail-toggle:focus-visible {
		border-color: var(--accent-gold);
		color: var(--accent-gold);
		outline: none;
	}
	.side-nav-collapsed .rail-toggle {
		margin: 0 auto;
	}
	.side-nav-collapsed .side-nav-links {
		padding-right: 0.5rem;
		padding-left: 0.5rem;
	}
	.side-nav-collapsed .app-nav-link {
		justify-content: center;
		padding-right: 0.5rem;
		padding-left: 0.5rem;
	}
	.side-nav-collapsed .nav-monogram {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--accent-gold) 32%, transparent);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0;
	}
	.side-nav-collapsed .side-nav-label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.side-nav-collapsed .side-nav-account {
		padding: 0.75rem 0.5rem;
	}
	.side-nav-collapsed .app-account-link {
		align-items: center;
		padding: 0.5rem;
	}
</style>
