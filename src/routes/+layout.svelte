<script lang="ts">
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import { isMobileRoute } from '#lib/mobile/routes';
	import { deLocalizeHref, locales, localizeHref } from '#lib/paraglide/runtime';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import './layout.css';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator && !import.meta.env.DEV) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
				// Best-effort service worker registration
			});
		}
	});

	// Halflight Now (the `(mobile)` route group) owns its own compact header,
	// tab bar, and mini player — it must not inherit the desktop chrome. Design
	// tokens stay shared (see MASTERPLAN.md "share domain logic, never whole
	// layouts"), so `layout.css` stays unconditional.
	let isMobile = $derived(isMobileRoute(page.url.pathname));
	let isListeningRoom = $derived(
		deLocalizeHref(page.url.pathname) === '/app' ||
			deLocalizeHref(page.url.pathname).startsWith('/app/')
	);
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href="/icons/halflight-32.png" />
	<link rel="icon" type="image/png" sizes="192x192" href="/icons/halflight-192.png" />
	{#if isMobile}
		<link rel="manifest" href="/manifest.webmanifest" />
		<meta name="theme-color" content="#0b0d10" />
		<meta name="mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="apple-mobile-web-app-title" content="Halflight" />
		<link rel="apple-touch-icon" sizes="192x192" href="/icons/halflight-192.png" />
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
