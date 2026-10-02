<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, setContext } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import MiniPlayer from '#lib/components/mobile/MiniPlayer.svelte';
	import MobileNavigationMenu from '#lib/components/mobile/MobileNavigationMenu.svelte';
	import NowTabBar from '#lib/components/mobile/NowTabBar.svelte';
	import PlaylistDialog from '#lib/components/music/PlaylistDialog.svelte';
	import {
		managesMobileScroll,
		mobileScrollKey,
		shouldFocusMobileDestination,
		MOBILE_PLAYER_NAVIGATION,
		mobilePlayerReturnTarget,
		isNowRoute,
		type MobilePlayerNavigation
	} from '#lib/mobile/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let mainElement: HTMLElement;
	const scrollPositions = new SvelteMap<string, number>();
	const playerNavigation = $state<MobilePlayerNavigation>({ returnTo: resolve('/(mobile)/home') });
	setContext(MOBILE_PLAYER_NAVIGATION, playerNavigation);

	// Halflight Now writes are attributed separately from the desktop Listening
	// Room (see player.svelte.ts's `origin` field / MASTERPLAN's session
	// contract). Theming is initialised once by the root layout already.
	$effect(() => {
		player.origin = 'halflight-now';
		player.applyStreamingSettings(data.streamingSettings);
		player.restorePlaybackState(data.playbackState);
	});

	onMount(() => {
		player.startSessionSync();
		return () => player.flushPersistence();
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

	const isOnNowRoute = $derived(isNowRoute(page.url.pathname));
	const isFullNowPlaying = $derived(
		page.route.id === '/(mobile)/now' && Boolean(player.currentTrack)
	);
	const showChrome = $derived(!isOnNowRoute || !player.currentTrack);
</script>

<div class="mobile-shell flex min-h-dvh flex-col bg-(--surface-canvas) text-(--text-primary)">
	{#if showChrome}
		<header class="mobile-app-header flex shrink-0 items-center gap-1">
			<MobileNavigationMenu currentPath={page.url.pathname} />
			<a class="mobile-brand" href={resolve('/(mobile)/home')} aria-label={m.brand_name()}>
				<span>{m.brand_name()}</span>
			</a>
		</header>
	{/if}
	<main
		bind:this={mainElement}
		id="main-content"
		class="mobile-scroll-region min-h-0 flex-1 overflow-y-auto"
	>
		{@render children()}
	</main>
	{#if !isFullNowPlaying}
		<MiniPlayer safeArea={!showChrome} />
	{/if}
	{#if showChrome}<NowTabBar currentPath={page.url.pathname} />{/if}
</div>

<PlaylistDialog />

<style>
	.mobile-shell {
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		min-height: 100dvh;
		background:
			radial-gradient(
				120% 44% at 50% -8%,
				color-mix(in oklab, var(--action) 15%, transparent),
				transparent 70%
			),
			var(--surface-canvas);
		isolation: isolate;
	}

	.mobile-app-header {
		min-height: calc(3.25rem + env(safe-area-inset-top));
		padding-top: env(safe-area-inset-top);
		border-bottom: 1px solid color-mix(in oklab, var(--border-subtle) 82%, transparent);
		background: color-mix(in oklab, var(--surface-raised) 84%, transparent);
		backdrop-filter: blur(18px) saturate(1.35);
		-webkit-backdrop-filter: blur(18px) saturate(1.35);
		padding-inline: 0.4rem;
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
		padding-bottom: env(safe-area-inset-bottom);
		overscroll-behavior-y: contain;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
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
