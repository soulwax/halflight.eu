<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, setContext } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { deLocalizeHref, localizeHref } from '#lib/paraglide/runtime';
	import ConnectTidalNotice from '#lib/components/app/ConnectTidalNotice.svelte';
	import MiniPlayer from '#lib/components/mobile/MiniPlayer.svelte';
	import MobileNavigationMenu from '#lib/components/mobile/MobileNavigationMenu.svelte';
	import NowTabBar from '#lib/components/mobile/NowTabBar.svelte';
	import MobileRecovery from '#lib/components/mobile/MobileRecovery.svelte';
	import PlaylistDialog from '#lib/components/music/PlaylistDialog.svelte';
	import { MobileSearchSession, MOBILE_SEARCH_SESSION } from '#lib/mobile/search-session.svelte.js';
	import {
		readMobileViewportBox,
		setMobileViewportBox,
		standaloneBottomInset
	} from '#lib/mobile/viewport-height.js';
	import {
		managesMobileScroll,
		mobileScrollKey,
		shouldFocusMobileDestination,
		MOBILE_PLAYER_NAVIGATION,
		MOBILE_DETAIL_NAVIGATION,
		rememberMobileDetailReturn,
		mobilePlayerReturnTarget,
		isNowRoute,
		type MobilePlayerNavigation
	} from '#lib/mobile/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let mainElement: HTMLElement;
	let shellElement: HTMLElement;
	const scrollPositions = new SvelteMap<string, number>();
	const playerNavigation = $state<MobilePlayerNavigation>({ returnTo: resolve('/(mobile)/home') });
	setContext(MOBILE_PLAYER_NAVIGATION, playerNavigation);
	const detailReturnTargets = new SvelteMap<string, string>();
	setContext(MOBILE_DETAIL_NAVIGATION, { returnTargets: detailReturnTargets });
	setContext(MOBILE_SEARCH_SESSION, new MobileSearchSession());

	// Halflight Now writes are attributed separately from the desktop Listening
	// Room (see player.svelte.ts's `origin` field / MASTERPLAN's session
	// contract). Theming is initialised once by the root layout already.
	$effect(() => {
		player.origin = 'halflight-now';
		player.applyStreamingSettings(data.streamingSettings);
		player.restorePlaybackState(data.playbackState, data.knownUnavailableIds);
	});

	onMount(() => {
		player.startSessionSync();
		const visualViewport = window.visualViewport;
		const standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (standalone) document.documentElement.classList.add('mobile-standalone');
		// env() is only readable through layout, so a hidden probe reports the inset.
		const insetProbe = document.createElement('div');
		insetProbe.setAttribute('aria-hidden', 'true');
		insetProbe.style.cssText =
			'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
		if (standalone) document.body.append(insetProbe);
		const syncBottomInset = () => {
			if (!standalone) return;
			const safeBottom = Number.parseFloat(getComputedStyle(insetProbe).paddingBottom) || 0;
			const inset = standaloneBottomInset(safeBottom, window.screen, {
				width: window.innerWidth,
				height: window.innerHeight
			});
			shellElement.style.setProperty('--mobile-bottom-inset', `${inset}px`);
		};
		const syncViewportHeight = () => {
			const activeElement = document.activeElement;
			const hasEditableFocus =
				activeElement instanceof HTMLElement &&
				(activeElement.isContentEditable ||
					activeElement.matches(
						'textarea, input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="hidden"])'
					));
			const keyboardOpen = Boolean(
				standalone &&
				hasEditableFocus &&
				visualViewport &&
				visualViewport.height < window.innerHeight - 80
			);
			setMobileViewportBox(
				shellElement,
				readMobileViewportBox(window.visualViewport, window.innerHeight, {
					standalone,
					keyboardOpen
				})
			);
			syncBottomInset();
		};
		syncViewportHeight();
		visualViewport?.addEventListener('resize', syncViewportHeight);
		visualViewport?.addEventListener('scroll', syncViewportHeight);
		window.addEventListener('resize', syncViewportHeight);
		window.addEventListener('orientationchange', syncViewportHeight);
		window.addEventListener('pageshow', syncViewportHeight);
		return () => {
			document.documentElement.classList.remove('mobile-standalone');
			insetProbe.remove();
			visualViewport?.removeEventListener('resize', syncViewportHeight);
			visualViewport?.removeEventListener('scroll', syncViewportHeight);
			window.removeEventListener('resize', syncViewportHeight);
			window.removeEventListener('orientationchange', syncViewportHeight);
			window.removeEventListener('pageshow', syncViewportHeight);
			player.flushPersistence();
		};
	});

	// "The mini player grows into Now Playing" (MASTERPLAN.md). Scoped to this
	// layout so it only ever wraps mobile-to-mobile navigations — `/app/**`
	// never mounts this component tree. Skips itself under reduced motion,
	// which the shared global CSS rule (layout.css) cannot reach because the
	// View Transitions API isn't a `transition-duration`.
	onNavigate((navigation) => {
		player.flushPersistence();
		const routeNavigation = {
			from: navigation.from?.url ?? null,
			to: navigation.to?.url ?? null,
			shallow: navigation.shallow
		};
		const managesScroll = managesMobileScroll(routeNavigation);
		if (navigation.type !== 'popstate') {
			rememberMobileDetailReturn(routeNavigation, detailReturnTargets);
		}
		const returnTarget = mobilePlayerReturnTarget(routeNavigation.from, routeNavigation.to);
		if (returnTarget) playerNavigation.returnTo = returnTarget;
		if (managesScroll && routeNavigation.from) {
			scrollPositions.set(mobileScrollKey(routeNavigation.from), mainElement.scrollTop);
		}

		const afterNavigate = () => {
			if (!managesScroll || !routeNavigation.to) return;
			mainElement.scrollTop = scrollPositions.get(mobileScrollKey(routeNavigation.to)) ?? 0;

			if (!shouldFocusMobileDestination(routeNavigation)) return;
			const heading = mainElement.querySelector<HTMLElement>('h1');
			if (!heading) return;
			if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
			heading.focus({ preventScroll: true });
		};

		if (
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return afterNavigate;
		}

		return new Promise<() => void>((finishTransition) => {
			document.startViewTransition(async () => {
				finishTransition(afterNavigate);
				await navigation.complete;
			});
		});
	});

	// The shell is pinned to the viewport and only <main> scrolls, but iOS Safari
	// still scrolls the window to reveal a focused field and can leave it offset
	// once the keyboard closes. Snap it back so the app never sits shifted.
	function resetWindowScroll() {
		requestAnimationFrame(() => {
			if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
		});
	}

	const isOnNowRoute = $derived(isNowRoute(page.url.pathname));
	const isFullNowPlaying = $derived(
		page.route.id === '/(mobile)/now' && Boolean(player.currentTrack)
	);
	const isQueueRoute = $derived(page.route.id === '/(mobile)/now/queue');
	const showChrome = $derived(!isOnNowRoute || !player.currentTrack);
</script>

<div
	bind:this={shellElement}
	class="mobile-shell flex flex-col bg-(--surface-canvas) text-(--text-primary)"
	onfocusout={resetWindowScroll}
>
	{#if showChrome}
		<header class="mobile-app-header flex shrink-0 items-center gap-1">
			<MobileNavigationMenu currentPath={page.url.pathname} />
			<a class="mobile-brand" href={resolve('/(mobile)/home')} aria-label={m.brand_name()}>
				<span>{m.brand_name()}</span>
			</a>
		</header>
	{/if}
	<MobileRecovery includePlayback={!isFullNowPlaying} includeQueueSync={!isQueueRoute} />
	<main
		bind:this={mainElement}
		id="main-content"
		class="mobile-scroll-region min-h-0 flex-1 overflow-y-auto"
		class:full-now={isFullNowPlaying}
		class:no-chrome={!showChrome && !isFullNowPlaying}
	>
		{#if !isFullNowPlaying}
			<ConnectTidalNotice
				connection={data.connection}
				settingsHref={localizeHref(resolve('/(mobile)/settings'))}
				hidden={deLocalizeHref(page.url.pathname) === '/settings'}
			/>
		{/if}
		{@render children()}
	</main>
	{#if !isFullNowPlaying}
		<MiniPlayer safeArea={!showChrome} />
	{/if}
	{#if showChrome}<NowTabBar currentPath={page.url.pathname} />{/if}
</div>

<PlaylistDialog />

<style>
	/* No leeway: the document itself never scrolls, bounces or pans. Only <main>
	   (and sheets) scroll, and they don't chain their overscroll into the page. */
	:global(html:has(.mobile-shell)),
	:global(body:has(.mobile-shell)) {
		height: 100%;
		overflow: hidden;
		overscroll-behavior: none;
		background-color: var(--surface-canvas);
	}

	/* The standalone app can expose a home-indicator strip beyond its visual
	   viewport. Match that strip to the bottom navigation without moving controls. */
	:global(html.mobile-standalone:has(.mobile-shell)),
	:global(html.mobile-standalone body:has(.mobile-shell)) {
		background-color: var(--surface-raised);
	}

	.mobile-shell {
		/* Header controls sit this far below the safe area, not flush against it. */
		--mobile-header-offset: 0.375rem;
		/* What the tab bar and mini player pad below themselves. The browser keeps
		   the whole home-indicator inset; the installed app drops whatever part of
		   it the window already ends above (see standaloneBottomInset), so the
		   navigation sits at the bottom edge instead of floating over spare space. */
		--mobile-bottom-inset: env(safe-area-inset-bottom, 0px);
		/* JS refreshes these from visualViewport as browser chrome, keyboard and
		   orientation change. Viewport units are only the pre-hydration fallback;
		   some iOS standalone versions report a stale 100dvh/100lvh value. */
		position: fixed;
		top: var(--mobile-viewport-top, 0px);
		inset-inline: 0;
		height: var(--mobile-viewport-height, 100vh);
		min-height: 0;
		overflow: hidden;
		/* No double-tap zoom; pinch zoom stays available. */
		touch-action: manipulation;
		-webkit-text-size-adjust: 100%;
		text-size-adjust: 100%;
		background:
			radial-gradient(
				120% 44% at 50% -8%,
				color-mix(in oklab, var(--action) 15%, transparent),
				transparent 70%
			),
			var(--surface-canvas);
		isolation: isolate;
	}

	@supports (height: 100dvh) {
		.mobile-shell {
			height: var(--mobile-viewport-height, 100dvh);
		}
	}

	/* iOS zooms the page into any focused field under 16px. */
	.mobile-shell :global(:is(input:not([type='range']), textarea, select)) {
		font-size: max(1rem, 16px);
	}

	.mobile-app-header {
		min-height: calc(3.25rem + var(--mobile-header-offset) + env(safe-area-inset-top));
		padding-top: calc(env(safe-area-inset-top) + var(--mobile-header-offset));
		padding-right: max(0.4rem, env(safe-area-inset-right));
		padding-left: max(0.4rem, env(safe-area-inset-left));
		border-bottom: 1px solid color-mix(in oklab, var(--border-subtle) 82%, transparent);
		background: color-mix(in oklab, var(--surface-raised) 84%, transparent);
		backdrop-filter: blur(18px) saturate(1.35);
		-webkit-backdrop-filter: blur(18px) saturate(1.35);
	}

	.mobile-brand {
		flex: none;
		min-width: 0;
		padding-inline: 0.35rem;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		text-decoration: none;
		text-transform: lowercase;
	}

	.mobile-brand:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.mobile-scroll-region {
		padding-bottom: var(--mobile-bottom-inset);
		overscroll-behavior: contain;
		scrollbar-width: none;
		overflow-x: hidden;
	}

	/* Now's queue, lyrics and credits hide the app header, so they own the safe area;
	   their own top padding already spaces the back control below it. */
	.mobile-scroll-region.no-chrome {
		padding-top: env(safe-area-inset-top);
	}

	.mobile-scroll-region.full-now {
		padding-bottom: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.mobile-scroll-region::-webkit-scrollbar {
		display: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.mobile-app-header {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
</style>
