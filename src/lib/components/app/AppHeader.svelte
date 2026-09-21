<script lang="ts">
	import HeaderSearch from '#lib/components/app/HeaderSearch.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { Library, LogIn, LogOut, Menu, Search, Settings, Shield } from '@lucide/svelte';
	import { deLocalizeHref } from '#lib/paraglide/runtime';
	import { isCurrentNavigationItem, type AppNavigationItem } from './navigation.js';

	interface Props {
		user?: {
			name?: string;
			email?: string;
			isAdministrator?: boolean;
			isFirstAdministrator?: boolean;
		} | null;
		showSearch?: boolean;
		navigation?: AppNavigationItem[];
		currentPath?: string;
		accountHref?: string;
		accountLabel?: string;
		signOutAction?: string;
		signOutLabel?: string;
	}

	let {
		user = null,
		showSearch = true,
		navigation = [],
		currentPath = '',
		accountHref,
		accountLabel,
		signOutAction,
		signOutLabel
	}: Props = $props();
	let mobileMenuOpen = $state(false);
	// The two destinations that stay one tap away as header symbols; everything
	// else lives in the menu. Matched by route, never by (localised) label.
	const mobileSearch = $derived(
		navigation.find((item) => deLocalizeHref(item.href) === '/app/search')
	);
	const mobileLibrary = $derived(
		navigation.find((item) => deLocalizeHref(item.href) === '/app/library')
	);
</script>

<header
	class="app-header flex h-full w-full shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-raised)_94%,transparent)] px-(--shell-gutter) backdrop-blur-md sm:gap-4"
>
	<div class="desktop-header-content">
		<a href={user ? '/app' : '/'} class="header-brand" aria-label={m.brand_name()}>
			<span>{m.brand_name()}</span>
		</a>

		<div class="header-search-slot">
			{#if user && showSearch}
				<HeaderSearch />
			{/if}
		</div>

		<nav class="header-actions" aria-label={m.nav_primary()}>
			{#if user?.isAdministrator}
				<a class="header-btn" href="/app/admin" title={m.nav_admin()} aria-label={m.nav_admin()}>
					<Shield size={18} aria-hidden="true" />
				</a>
			{/if}

			<a
				class="header-btn"
				href="/app/settings/tidal"
				title={m.nav_settings()}
				aria-label={m.nav_settings()}
			>
				<Settings size={18} aria-hidden="true" />
			</a>

			{#if user}
				<form method="POST" action="/logout">
					<button
						type="submit"
						class="header-btn header-btn--danger"
						title={m.sign_out()}
						aria-label={m.sign_out()}
					>
						<LogOut size={18} aria-hidden="true" />
					</button>
				</form>
			{:else}
				<a
					class="header-btn"
					href="/sign-in"
					title={m.sign_in_button()}
					aria-label={m.sign_in_button()}
				>
					<LogIn size={18} aria-hidden="true" />
				</a>
			{/if}
		</nav>
	</div>

	<div class="mobile-header-content">
		<button
			type="button"
			class="header-btn mobile-menu-trigger"
			aria-label={m.nav_mobile()}
			title={m.nav_mobile()}
			onclick={() => (mobileMenuOpen = true)}
		>
			<Menu size={21} aria-hidden="true" />
		</button>
		<a
			href={user ? '/app' : '/'}
			class="header-brand mobile-header-brand"
			aria-label={m.brand_name()}
		>
			<span>{m.brand_name()}</span>
		</a>
		<nav class="mobile-header-actions" aria-label={m.nav_mobile()}>
			{#if mobileSearch}
				<a
					class="header-btn"
					href={mobileSearch.href}
					aria-current={isCurrentNavigationItem(mobileSearch, currentPath) ? 'page' : undefined}
					aria-label={mobileSearch.label}
					title={mobileSearch.label}
				>
					<Search size={19} aria-hidden="true" />
				</a>
			{/if}
			{#if mobileLibrary}
				<a
					class="header-btn"
					href={mobileLibrary.href}
					aria-current={isCurrentNavigationItem(mobileLibrary, currentPath) ? 'page' : undefined}
					aria-label={mobileLibrary.label}
					title={mobileLibrary.label}
				>
					<Library size={19} aria-hidden="true" />
				</a>
			{/if}
		</nav>
	</div>
</header>

<Dialog
	bind:open={mobileMenuOpen}
	title={m.nav_primary()}
	contentClass="app-mobile-menu-sheet"
	class="app-mobile-menu-body"
>
	<nav aria-label={m.nav_primary()}>
		<ul class="app-mobile-menu-list">
			{#each navigation as item (item.href)}
				{@const current = isCurrentNavigationItem(item, currentPath)}
				<li>
					<a
						href={item.href}
						aria-current={current ? 'page' : undefined}
						class:app-mobile-menu-link-current={current}
						class="app-mobile-menu-link"
						onclick={() => (mobileMenuOpen = false)}
					>
						{#if item.icon}<item.icon size={20} aria-hidden="true" />{/if}
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
			{#if user?.isAdministrator}
				<li>
					<a
						href="/app/admin"
						aria-current={deLocalizeHref(currentPath) === '/app/admin' ? 'page' : undefined}
						class:app-mobile-menu-link-current={deLocalizeHref(currentPath) === '/app/admin'}
						class="app-mobile-menu-link"
						onclick={() => (mobileMenuOpen = false)}
					>
						<Shield size={20} aria-hidden="true" />
						<span>{m.nav_admin()}</span>
					</a>
				</li>
			{/if}
			{#if accountHref && accountLabel}
				<li>
					<a
						href={accountHref}
						class="app-mobile-menu-link"
						onclick={() => (mobileMenuOpen = false)}
					>
						<Settings size={20} aria-hidden="true" />
						<span>{accountLabel}</span>
					</a>
				</li>
			{/if}
			{#if signOutAction && signOutLabel}
				<li>
					<form method="POST" action={signOutAction}>
						<button type="submit" class="app-mobile-menu-link app-mobile-menu-signout w-full">
							<LogOut size={20} aria-hidden="true" />
							<span>{signOutLabel}</span>
						</button>
					</form>
				</li>
			{/if}
		</ul>
	</nav>
</Dialog>

<style>
	/* One control metric for every inner header element. */
	.header-brand,
	.header-btn {
		display: flex;
		flex: none;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-lg);
		transition:
			border-color 140ms ease,
			background-color 140ms ease,
			color 140ms ease,
			opacity 140ms ease;
	}

	.header-brand {
		padding-inline: 0.25rem;
		color: var(--text-primary);
		font-size: 1.05rem;
		font-weight: 750;
		letter-spacing: -0.035em;
		text-decoration: none;
		text-transform: lowercase;
	}

	.header-btn {
		width: 2.5rem;
	}

	.header-brand:hover {
		opacity: 0.75;
	}

	.header-brand:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.header-search-slot {
		display: flex;
		min-width: 0;
		flex: 1;
	}

	.header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.5rem;
	}

	.header-actions form {
		display: flex;
	}

	.header-btn {
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.header-btn:hover {
		border-color: color-mix(in oklab, var(--action) 55%, var(--border-subtle));
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.header-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.header-btn--danger:hover {
		border-color: color-mix(in oklab, var(--danger) 55%, var(--border-subtle));
		background: var(--danger-subtle);
		color: var(--danger);
	}

	.desktop-header-content,
	.mobile-header-content {
		display: flex;
		width: 100%;
		align-items: center;
	}

	.mobile-header-content {
		display: none;
	}

	@media (max-width: 63.99rem) {
		.desktop-header-content {
			display: none;
		}

		.mobile-header-content {
			display: flex;
			gap: 0.35rem;
		}

		.mobile-header-brand {
			min-width: 0;
			flex: 1;
			padding-inline: 0.2rem;
		}

		.mobile-header-actions {
			display: flex;
			gap: 0.35rem;
		}

		.header-btn {
			width: 2.25rem;
			height: 2.25rem;
		}
	}

	.app-mobile-menu-list {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0.5rem;
		list-style: none;
	}

	.app-mobile-menu-link {
		display: flex;
		min-height: 3rem;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem 0.85rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		font-weight: 650;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.app-mobile-menu-link:hover {
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.app-mobile-menu-link-current {
		background: color-mix(in oklab, var(--action) 14%, transparent);
		color: var(--action);
	}

	.app-mobile-menu-signout:hover {
		background: var(--danger-subtle);
		color: var(--danger);
	}

	.app-mobile-menu-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	:global(.dialog-content.app-mobile-menu-sheet) {
		top: 0;
		left: 0;
		width: min(21rem, calc(100% - 3rem));
		max-width: none;
		max-height: 100dvh;
		height: 100dvh;
		transform: none;
		border-width: 0 1px 0 0;
		border-radius: 0;
		box-shadow: 18px 0 42px -24px rgb(0 0 0 / 72%);
		animation: app-mobile-menu-slide-in var(--dur-med) ease-out;
	}

	@keyframes app-mobile-menu-slide-in {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.dialog-content.app-mobile-menu-sheet) {
			animation: none;
		}
	}

	:global(.app-mobile-menu-sheet .dialog-header) {
		min-height: calc(3.25rem + env(safe-area-inset-top));
		padding-top: calc(0.7rem + env(safe-area-inset-top));
		padding-bottom: 0.7rem;
	}
</style>
