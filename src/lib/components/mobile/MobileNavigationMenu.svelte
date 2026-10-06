<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Home, Library, Menu, Search, Settings } from '@lucide/svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { rememberSiteChoice, switchSitePath } from '#lib/mobile/site-entry';
	import { localizeHref } from '#lib/paraglide/runtime';
	import { page } from '$app/state';

	let { currentPath }: { currentPath: string } = $props();
	let open = $state(false);

	const items = $derived([
		{ href: resolve('/(mobile)/home'), label: m.now_tab_home(), icon: Home },
		{ href: resolve('/(mobile)/search'), label: m.now_tab_search(), icon: Search },
		{ href: resolve('/(mobile)/library'), label: m.now_tab_library(), icon: Library },
		{ href: resolve('/(mobile)/now'), label: m.now_tab_now(), icon: Disc },
		{ href: resolve('/(mobile)/settings'), label: m.mobile_settings_title(), icon: Settings }
	]);
</script>

<button
	type="button"
	class="mobile-menu-trigger flex h-12 w-12 shrink-0 items-center justify-center"
	aria-label={m.nav_mobile()}
	title={m.nav_mobile()}
	onclick={() => (open = true)}
>
	<Menu size={22} aria-hidden="true" />
</button>

<Dialog bind:open title={m.nav_primary()} contentClass="mobile-menu-sheet" class="mobile-menu-body">
	<nav aria-label={m.nav_primary()}>
		<ul class="mobile-menu-list">
			{#each items as item (item.href)}
				{@const current = currentPath === item.href || currentPath.startsWith(`${item.href}/`)}
				<li>
					<a
						href={item.href}
						aria-current={current ? 'page' : undefined}
						class:mobile-menu-link-current={current}
						class="mobile-menu-link"
						onclick={() => (open = false)}
					>
						<item.icon size={20} aria-hidden="true" />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
		<a
			class="mobile-menu-link"
			href={localizeHref(`${switchSitePath(currentPath, 'desktop')}${page.url.search}`)}
			onclick={() => rememberSiteChoice('desktop')}
		>
			<span>{m.site_desktop_view()}</span>
		</a>
	</nav>
</Dialog>

<style>
	.mobile-menu-trigger {
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) var(--ease-out),
			color var(--dur-fast) var(--ease-out);
	}

	.mobile-menu-trigger:hover {
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.mobile-menu-trigger:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -3px;
	}

	.mobile-menu-list {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0.5rem;
		list-style: none;
	}

	.mobile-menu-link {
		display: flex;
		min-height: 3rem;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem 0.85rem;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-weight: 650;
		text-decoration: none;
		transition:
			background-color var(--dur-fast) var(--ease-out),
			color var(--dur-fast) var(--ease-out);
	}

	.mobile-menu-link:hover {
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.mobile-menu-link-current {
		background: color-mix(in oklab, var(--action) 14%, transparent);
		color: var(--action);
	}

	.mobile-menu-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	:global(.dialog-content.mobile-menu-sheet) {
		top: 0;
		bottom: 0;
		left: 0;
		width: min(21rem, calc(100% - 3rem));
		max-width: none;
		max-height: none;
		height: auto;
		transform: none;
		border-width: 0 1px 0 0;
		border-radius: 0;
		box-shadow: 18px 0 42px -24px rgb(0 0 0 / 72%);
		animation: mobileMenuSlideIn 0.18s var(--ease-out);
	}

	:global(.mobile-menu-sheet .dialog-header) {
		min-height: calc(3.25rem + env(safe-area-inset-top));
		padding-top: calc(0.7rem + env(safe-area-inset-top));
		padding-bottom: 0.7rem;
	}

	@keyframes mobileMenuSlideIn {
		from {
			transform: translateX(-1rem);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mobile-menu-trigger,
		.mobile-menu-link {
			transition: none;
		}

		:global(.dialog-content.mobile-menu-sheet) {
			animation: none;
		}
	}
</style>
