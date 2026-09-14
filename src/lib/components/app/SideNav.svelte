<script lang="ts">
	import { LogOut, PanelLeftClose, PanelLeftOpen, Settings } from '@lucide/svelte';
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
	class="side-nav hidden h-full w-full shrink-0 bg-[var(--surface-raised)] md:flex md:flex-col"
>
	{#if onToggleRail && collapseRailLabel && expandRailLabel}
		<div class="flex justify-end px-3 pt-3">
			<button
				type="button"
				class="rail-toggle"
				onclick={onToggleRail}
				aria-label={collapsed ? expandRailLabel : collapseRailLabel}
				title={collapsed ? expandRailLabel : collapseRailLabel}
			>
				{#if collapsed}
					<PanelLeftOpen size={17} aria-hidden="true" />
				{:else}
					<PanelLeftClose size={17} aria-hidden="true" />
				{/if}
			</button>
		</div>
	{/if}

	<nav class="side-nav-links px-3 pt-3 pb-5" aria-label={navigationLabel}>
		<ul class="space-y-0.5">
			{#each navigation as item (item.href)}
				{#if item.dividerBefore}
					<li class="side-nav-divider" aria-hidden="true"></li>
				{/if}
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

	<div class="side-nav-account mt-auto border-t border-[var(--border-subtle)] p-3">
		{#if accountHref && accountLabel}
			<a class="app-account-link" href={accountHref} title={collapsed ? accountLabel : undefined}>
				<Settings size={17} aria-hidden="true" />
				<div class="side-nav-labels">
					{#if userName}<span class="side-nav-label truncate font-bold">{userName}</span>{/if}
					<span class="side-nav-label text-xs tracking-wider text-[var(--text-muted)] uppercase"
						>{accountLabel}</span
					>
				</div>
			</a>
		{:else if userName}
			<p class="side-nav-label truncate text-xs tracking-wider text-[var(--text-muted)] uppercase">
				{userName}
			</p>
		{/if}
		{#if signOutAction && signOutLabel}
			<form method="POST" action={signOutAction} class="mt-2">
				<button
					class="app-account-link app-account-link-signout w-full cursor-pointer text-left"
					type="submit"
					title={collapsed ? signOutLabel : undefined}
				>
					<LogOut size={17} aria-hidden="true" />
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

	/* Matches the rail's nav links: same radius, muted → hover, no chrome. */
	.rail-toggle {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 140ms ease,
			background-color 140ms ease;
	}
	.rail-toggle:hover {
		background: var(--paper);
		color: var(--text-primary);
	}
	.rail-toggle:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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
	.side-nav-divider {
		height: 1px;
		margin: 0.75rem 0.5rem;
		background: var(--border-subtle);
	}
	.side-nav-collapsed .side-nav-divider {
		margin-right: 0.2rem;
		margin-left: 0.2rem;
	}
	.side-nav-collapsed .nav-monogram {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
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
	.side-nav-collapsed .side-nav-labels {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.side-nav-collapsed .app-account-link {
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
	}
	.side-nav-account :global(.app-account-link) {
		min-height: 2.5rem;
		padding: 0.55rem 0.7rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	/* Account links expand beyond the icon-only collapsed layout. */
	.side-nav-account :global(.app-account-link) {
		flex-direction: column;
	}
	.side-nav-account :global(.app-account-link-signout) {
		flex-direction: row;
		gap: 0.4rem;
	}
	/* Sign-out gets the same danger settle as the header's sign-out button. */
	.side-nav-account :global(.app-account-link-signout:hover) {
		border-color: color-mix(in oklab, var(--danger) 55%, var(--border-subtle));
		background: var(--danger-subtle);
		color: var(--danger);
	}
</style>
