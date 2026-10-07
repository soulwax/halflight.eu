<script lang="ts">
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import { isMobileRoute } from '#lib/mobile/routes';
	import { THEME_META } from '#lib/theme';
	import { deLocalizeHref, locales, localizeHref } from '#lib/paraglide/runtime';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { searchHistory } from '#lib/search/history.svelte';
	import type { LayoutData } from './$types';
	import './layout.css';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	$effect(() => searchHistory.setOwner(data.user?.id ?? null));

	// The mobile browser/OS chrome colour cannot be a CSS custom property — it
	// needs a literal string at head-render time — so this is the one place
	// each theme's `--paper` is deliberately restated outside `layout.css`.
	const MOBILE_CHROME_COLOR: Record<LayoutData['theme'], string> = {
		dark: '#0b0d10',
		light: '#ffffff',
		'warm-night': '#1a1512',
		'blue-hour': '#10182d',
		electric: '#0f0f1a',
		overcast: '#eef0f2',
		terrarium: '#0c1713',
		riso: '#fff5df',
		aurora: '#0a0e16',
		noir: '#050507'
	};

	onMount(() => {
		if ('serviceWorker' in navigator && !import.meta.env.DEV) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
				// Best-effort service worker registration
			});
		}
	});

	// `app.html` already bakes the right theme into the first response via
	// `hooks.server.ts`'s `transformPageChunk`, so this never causes the flash
	// it would on a cold load. It exists for the case that value changes
	// without a full navigation — the Appearance settings action returns fresh
	// `theme` data — so the switch is instant instead of waiting for reload.
	$effect(() => {
		document.documentElement.dataset.theme = data.theme;
	});

	// Halflight Now (the `(mobile)` route group) owns its own compact header,
	// tab bar, and mini player — it must not inherit the desktop chrome. Design
	// tokens stay shared (see MASTERPLAN.md "share domain logic, never whole
	// layouts"), so `layout.css` stays unconditional.
	let isMobile = $derived(isMobileRoute(page.url.pathname));
	let isListeningRoom = $derived(
		deLocalizeHref(page.url.pathname) === '/' ||
			deLocalizeHref(page.url.pathname) === '/app' ||
			deLocalizeHref(page.url.pathname).startsWith('/app/')
	);
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href="/icons/halflight-32.png" />
	<link rel="icon" type="image/png" sizes="192x192" href="/icons/halflight-192.png" />
	{#if isMobile}
		<link rel="manifest" href="/manifest.webmanifest" />
		<meta name="theme-color" content={MOBILE_CHROME_COLOR[data.theme]} />
		<meta name="mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<!-- Opaque, not black-translucent: affected iOS versions (WebKit bug 301994,
		     26.1, 26.5, 27 beta) size a Home Screen app to the screen minus the status
		     bar, so a translucent app starting at the top was cut off 62px short of
		     the bottom edge. Starting below the status bar, the same window reaches
		     the bottom; nothing drew under the status bar but header padding anyway. -->
		<meta
			name="apple-mobile-web-app-status-bar-style"
			content={THEME_META[data.theme].colorScheme === 'light' ? 'default' : 'black'}
		/>
		<meta name="apple-mobile-web-app-title" content="Halflight" />
		<link rel="apple-touch-icon" sizes="180x180" href="/icons/halflight-180.png" />
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
