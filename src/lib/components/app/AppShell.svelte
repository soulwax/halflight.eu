<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileNav from './MobileNav.svelte';
	import SideNav from './SideNav.svelte';
	import type { AppBrand, AppNavigationItem } from './navigation.js';

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
			class="min-w-0 flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-10"
			tabindex="-1"
		>
			{@render children()}
		</main>
	</div>
</div>

<MobileNav {navigation} {currentPath} {navigationLabel} {signOutAction} {signOutLabel} />
