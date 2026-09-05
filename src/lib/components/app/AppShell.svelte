<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileNav from './MobileNav.svelte';
	import SideNav from './SideNav.svelte';
	import type { AppNavigationItem } from './navigation.js';

	interface Props {
		children: Snippet;
		header?: Snippet;
		aside?: Snippet;
		asideLabel?: string;
		player?: Snippet;
		footer?: Snippet;
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
		header,
		aside,
		asideLabel,
		player,
		footer,
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

<div class="app-style-canvas app-shell-canvas">
	<div class="app-shell">
		<div class="app-shell-rail">
			<SideNav
				{navigation}
				{currentPath}
				{navigationLabel}
				{userName}
				{accountHref}
				{accountLabel}
				{signOutAction}
				{signOutLabel}
			/>
		</div>

		<div class="app-shell-header">
			{#if header}{@render header()}{/if}
		</div>

		<main id="main-content" class="app-shell-main" tabindex="-1">
			<div class="app-shell-main-content">{@render children()}</div>
		</main>

		{#if aside && asideLabel}
			<aside class="app-shell-aside" aria-label={asideLabel}>
				{@render aside()}
			</aside>
		{/if}

		{#if player}<div class="app-shell-player">{@render player()}</div>{/if}
		{#if footer}<div class="app-shell-footer">{@render footer()}</div>{/if}
	</div>
</div>

<MobileNav {navigation} {currentPath} {navigationLabel} {signOutAction} {signOutLabel} />

<style>
	.app-shell-canvas {
		min-height: 100dvh;
		background: var(--surface-canvas);
		color: var(--text-primary);
	}

	.app-shell {
		display: grid;
		min-height: 100dvh;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		grid-template-columns: var(--shell-rail-w) minmax(0, 1fr);
		grid-template-rows: var(--shell-header-h) minmax(0, 1fr) var(--shell-player-h) var(
				--shell-footer-h
			);
		grid-template-areas:
			'rail header'
			'rail main'
			'player player'
			'footer footer';
	}

	.app-shell-rail {
		grid-area: rail;
		min-height: 0;
		z-index: var(--z-rail);
	}
	.app-shell-header {
		grid-area: header;
		min-width: 0;
		z-index: var(--z-header);
	}
	.app-shell-main {
		grid-area: main;
		min-width: 0;
		overflow: auto;
		container-type: inline-size;
		padding: var(--shell-gutter);
	}
	.app-shell-main-content {
		width: min(100%, var(--content-max));
		margin: 0 auto;
	}
	.app-shell-aside {
		display: none;
		min-width: 0;
		overflow: auto;
		border-left: var(--hairline);
		background: var(--surface-raised);
		container-type: inline-size;
		z-index: var(--z-aside);
	}
	.app-shell-player {
		grid-area: player;
		min-width: 0;
		z-index: var(--z-player);
	}
	.app-shell-footer {
		grid-area: footer;
		z-index: var(--z-footer);
	}

	@media (min-width: 90rem) {
		.app-shell:has(.app-shell-aside) {
			grid-template-columns: var(--shell-rail-w) minmax(0, 1fr) var(--shell-aside-w);
			grid-template-areas:
				'rail header header'
				'rail main aside'
				'player player player'
				'footer footer footer';
		}
		.app-shell-aside {
			display: block;
			grid-area: aside;
		}
	}

	@media (max-width: 63.99rem) {
		.app-shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'header' 'main' 'player' 'footer';
		}
		.app-shell-rail {
			display: none;
		}
		.app-shell-main {
			padding-bottom: calc(var(--shell-gutter) + 4.5rem);
		}
	}
</style>
