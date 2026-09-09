<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Settings } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import MiniPlayer from '#lib/components/mobile/MiniPlayer.svelte';
	import NowTabBar from '#lib/components/mobile/NowTabBar.svelte';
	import {
		managesMobileScroll,
		mobileScrollKey,
		shouldFocusMobileDestination
	} from '#lib/mobile/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let mainElement: HTMLElement;
	const scrollPositions = new SvelteMap<string, number>();

	// Halflight Now writes are attributed separately from the desktop Listening
	// Room (see player.svelte.ts's `origin` field / MASTERPLAN's session
	// contract). Theming is initialised once by the root layout already.
	$effect(() => {
		player.origin = 'halflight-now';
		player.applyStreamingSettings(data.streamingSettings);
		player.restorePlaybackState(data.playbackState);
	});

	onMount(() => player.startSessionSync());

	// "The mini player grows into Now Playing" (MASTERPLAN.md). Scoped to this
	// layout so it only ever wraps mobile-to-mobile navigations — `/app/**`
	// never mounts this component tree. Skips itself under reduced motion,
	// which the shared global CSS rule (layout.css) cannot reach because the
	// View Transitions API isn't a `transition-duration`.
	onNavigate((navigation) => {
		const routeNavigation = {
			from: navigation.from?.url ?? null,
			to: navigation.to?.url ?? null,
			shallow: navigation.shallow
		};
		const managesScroll = managesMobileScroll(routeNavigation);
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

	const nowRoot = resolve('/(mobile)/now');
	const isOnNowRoute = $derived(
		page.url.pathname === nowRoot || page.url.pathname.startsWith(`${nowRoot}/`)
	);
</script>

<div class="mobile-shell flex min-h-dvh flex-col bg-(--surface-canvas) text-(--text-primary)">
	{#if !isOnNowRoute}
		<header class="mobile-app-header relative flex shrink-0 items-center justify-center">
			<a class="mobile-brand" href={resolve('/(mobile)/home')} aria-label={m.brand_name()}>
				<img src="/icons/emily-the-strange-music-with-many-paths-64.png" alt="" class="h-8 w-8" />
			</a>
			<a
				href={resolve('/(mobile)/settings')}
				class="mobile-header-action absolute right-1 flex h-12 w-12 items-center justify-center text-(--text-muted) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-(--focus-ring)"
				aria-label={m.mobile_settings_title()}
			>
				<Settings size={20} aria-hidden="true" />
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
	{#if !isOnNowRoute}
		<MiniPlayer />
		<NowTabBar currentPath={page.url.pathname} />
	{/if}
</div>

<style>
	.mobile-shell {
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
	}

	.mobile-brand {
		display: grid;
		place-items: center;
		min-width: 3rem;
		min-height: 3rem;
	}

	.mobile-header-action {
		bottom: 0;
		border-radius: var(--radius-full);
	}

	.mobile-scroll-region {
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
