<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { locales, localizeHref } from '#lib/paraglide/runtime';
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import { themeManager } from '#lib/theme/theme.svelte.js';
	import { isMobileRoute } from '#lib/mobile/routes';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Halflight Now (the `(mobile)` route group) owns its own compact header,
	// tab bar, and mini player — it must not inherit the desktop chrome. Design
	// tokens and theming stay shared (see MASTERPLAN.md "share domain logic,
	// never whole layouts"), so `layout.css` and `themeManager` stay unconditional.
	let isMobile = $derived(isMobileRoute(page.url.pathname));
	let isListeningRoom = $derived(
		page.url.pathname === '/app' || page.url.pathname.startsWith('/app/')
	);

	$effect(() => {
		themeManager.init(data.theme, data.visualStyle);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if isMobile}
		<link rel="manifest" href="/manifest.webmanifest" />
		<meta name="theme-color" content="#1d1a16" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="apple-mobile-web-app-title" content="Halflight" />
		<link rel="apple-touch-icon" href="/icons/halflight-now-180.png" />
	{/if}
</svelte:head>
{#if isMobile || isListeningRoom}
	{@render children()}
{:else}
	<div class="flex min-h-dvh flex-col">
		<AppHeader user={data.user} />
		<div class="flex-1">
			{@render children()}
		</div>
		<Footer />
	</div>
{/if}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
