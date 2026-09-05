<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Settings } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import synLogo from '#lib/assets/syn-logo.svg';
	import MiniPlayer from '#lib/components/mobile/MiniPlayer.svelte';
	import NowTabBar from '#lib/components/mobile/NowTabBar.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Halflight Now writes are attributed separately from the desktop Listening
	// Room (see player.svelte.ts's `origin` field / MASTERPLAN's session
	// contract). Theming is initialised once by the root layout already.
	$effect(() => {
		player.origin = 'halflight-now';
		player.applyStreamingSettings(data.streamingSettings);
		player.restorePlaybackState(data.playbackState);
	});

	// "The mini player grows into Now Playing" (MASTERPLAN.md). Scoped to this
	// layout so it only ever wraps mobile-to-mobile navigations — `/app/**`
	// never mounts this component tree. Skips itself under reduced motion,
	// which the shared global CSS rule (layout.css) cannot reach because the
	// View Transitions API isn't a `transition-duration`.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((finishTransition) => {
			document.startViewTransition(async () => {
				finishTransition();
				await navigation.complete;
			});
		});
	});

	const nowRoot = resolve('/(mobile)/now');
	const isOnNowRoute = $derived(
		page.url.pathname === nowRoot || page.url.pathname.startsWith(`${nowRoot}/`)
	);
</script>

<div class="flex min-h-dvh flex-col bg-(--surface-canvas) text-(--text-primary)">
	<header
		class="relative flex h-12 shrink-0 items-center justify-center border-b border-(--border-subtle) bg-(--surface-raised)/95 backdrop-blur-md"
	>
		<a href={resolve('/(mobile)/home')} aria-label={m.brand_name()}>
			<img src={synLogo} alt="" class="h-6 w-auto" />
		</a>
		<a
			href={resolve('/(mobile)/settings')}
			class="absolute right-1 flex h-11 w-11 items-center justify-center text-(--text-muted) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-(--focus-ring)"
			aria-label={m.mobile_settings_title()}
		>
			<Settings size={20} aria-hidden="true" />
		</a>
	</header>
	<main id="main-content" class="min-h-0 flex-1 overflow-y-auto">
		{@render children()}
	</main>
	{#if !isOnNowRoute}
		<MiniPlayer />
	{/if}
	<NowTabBar currentPath={page.url.pathname} />
</div>
