<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileNav from './MobileNav.svelte';
	import SideNav from './SideNav.svelte';
	import ThemeSelector from '#lib/components/ui/ThemeSelector.svelte';
	import type { AppBrand, AppNavigationItem } from './navigation.js';
	import synLogo from '#lib/assets/syn-logo.svg';

	interface Props {
		children: Snippet;
		brand: AppBrand;
		navigation: AppNavigationItem[];
		currentPath: string;
		skipLinkLabel: string;
		navigationLabel: string;
		userName?: string;
		accountHref?: string;
		accountLabel?: string;
		signOutAction?: string;
		signOutLabel?: string;
	}

	let {
		children,
		brand,
		navigation,
		currentPath,
		skipLinkLabel,
		navigationLabel,
		userName,
		accountHref,
		accountLabel,
		signOutAction,
		signOutLabel
	}: Props = $props();
</script>

<a class="app-skip-link" href="#main-content">{skipLinkLabel}</a>

<div class="min-h-[calc(100dvh-10px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
	<div
		class="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5 md:hidden"
	>
		<a class="block h-8 w-[7.75rem]" href={brand.href} aria-label={brand.label}>
			<img class="h-full w-full" src={synLogo} alt="" />
		</a>
		<div class="w-44">
			<ThemeSelector compact={true} id="mobile-theme-selector" />
		</div>
	</div>

	<div class="mx-auto flex min-h-[calc(100dvh-10px)] max-w-screen-2xl">
		<SideNav
			{brand}
			{navigation}
			{currentPath}
			{navigationLabel}
			{userName}
			{accountHref}
			{accountLabel}
			{signOutAction}
			{signOutLabel}
		/>

		<main
			id="main-content"
			class="min-w-0 flex-1 px-6 py-10 pb-40 sm:px-12 sm:py-16 lg:px-20 lg:py-20 lg:pb-40"
			tabindex="-1"
		>
			<div class="mx-auto w-full max-w-[var(--content-max)]">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<MobileNav {navigation} {currentPath} {navigationLabel} {signOutAction} {signOutLabel} />
