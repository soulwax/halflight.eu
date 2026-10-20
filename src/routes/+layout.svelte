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
	import { captureInstallPrompt, installPromptState } from '#lib/mobile/install-prompt.svelte';
	import PwaUpdateNotice from '#lib/components/mobile/PwaUpdateNotice.svelte';
	import PlaylistImportModal from '#lib/components/music/PlaylistImportModal.svelte';
	import { invalidateAll } from '$app/navigation';
	import TrackReplacementDialog from '#lib/components/player/TrackReplacementDialog.svelte';
	import ContextMenuBar from '#lib/components/ui/ContextMenuBar.svelte';
	import type { LayoutData } from './$types';
	import './layout.css';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	$effect(() => searchHistory.setOwner(data.user?.id ?? null));

	// Browser/OS chrome colours need literal strings at head-render time, so
	// each theme's canvas colour is restated here outside `layout.css`.
	const CHROME_COLOR: Record<LayoutData['theme'], string> = {
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
		const clearInstallPrompt = () => (installPromptState.event = null);
		window.addEventListener('beforeinstallprompt', captureInstallPrompt);
		window.addEventListener('appinstalled', clearInstallPrompt);
		if ('serviceWorker' in navigator && !import.meta.env.DEV) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
				// Best-effort service worker registration
			});
		}
		return () => {
			window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
			window.removeEventListener('appinstalled', clearInstallPrompt);
		};
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
	let isDesktopRecovery = $derived(deLocalizeHref(page.url.pathname) === '/desktop-offline');
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href="/icons/halflight-32.png" />
	<link rel="icon" type="image/png" sizes="192x192" href="/icons/halflight-192.png" />
	{#if isMobile}
		<link rel="manifest" href="/manifest.webmanifest" />
		<meta name="theme-color" content={CHROME_COLOR[data.theme]} />
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
	{:else if isListeningRoom || deLocalizeHref(page.url.pathname) === '/sign-in'}
		<link rel="manifest" href="/manifest-desktop.webmanifest" />
		<meta name="theme-color" content={CHROME_COLOR[data.theme]} />
	{/if}
</svelte:head>
{#if isMobile || isListeningRoom || isDesktopRecovery || deLocalizeHref(page.url.pathname) === '/sign-in'}
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

<!-- Every same-origin tab must be able to answer the worker's update-readiness
     check, including desktop pages and sign-in after an expired session. -->
<PwaUpdateNotice desktop={!isMobile} />

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
{#if data.user}{#key data.user.id}<TrackReplacementDialog /><PlaylistImportModal
			onImported={invalidateAll}
		/>{/key}<ContextMenuBar />{/if}
