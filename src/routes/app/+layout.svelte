<script lang="ts">
	import AppAside from '#lib/components/app/AppAside.svelte';
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import PlaylistDialog from '#lib/components/music/PlaylistDialog.svelte';
	import QueuePanel from '#lib/components/player/panels/QueuePanel.svelte';
	import Player from '#lib/components/player/Player.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { onNavigate } from '$app/navigation';
	import ConnectTidalNotice from '#lib/components/app/ConnectTidalNotice.svelte';
	import { deLocalizeHref, localizeHref } from '#lib/paraglide/runtime';
	import { player } from '#lib/player/player.svelte.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Disc3, Home, Library, Palette, Search, Sparkles, Waves, X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const navigation = $derived([
		{ href: localizeHref(resolve('/app')), label: m.nav_home(), icon: Home },
		{ href: localizeHref(resolve('/app/search')), label: m.nav_search(), icon: Search },
		{ href: localizeHref(resolve('/app/library')), label: m.nav_library(), icon: Library },
		{
			href: localizeHref(resolve('/app/mixes')),
			label: m.nav_mixes(),
			icon: Disc3,
			dividerBefore: true
		},
		{ href: localizeHref(resolve('/app/generate')), label: m.nav_generate(), icon: Sparkles },
		{ href: localizeHref(resolve('/app/settings/taste')), label: m.nav_taste(), icon: Waves },
		{
			href: localizeHref(resolve('/app/settings/appearance')),
			label: m.nav_appearance(),
			icon: Palette
		}
	]);
	const showHeaderSearch = $derived(deLocalizeHref(page.url.pathname) !== '/app/search');

	$effect(() => {
		// The player singleton also serves Halflight Now; reset attribution when
		// SPA navigation returns to the desktop listening room.
		player.origin = 'listening-room';
		player.applyStreamingSettings(data.streamingSettings);
		player.applyListeningPreferences(data.listeningPreferences);
		player.restorePlaybackState(data.playbackState, data.knownUnavailableIds);
	});

	onMount(() => {
		player.startSessionSync();
		return () => player.flushPersistence();
	});

	// A route can replace this layout tree before the normal debounce expires.
	// Persisting the journal here keeps navigation transparent to the session.
	onNavigate(() => player.flushPersistence());
</script>

{#snippet appHeader()}
	<AppHeader
		user={data.user}
		showSearch={showHeaderSearch}
		{navigation}
		currentPath={page.url.pathname}
		accountHref={localizeHref(resolve('/app/settings/tidal'))}
		accountLabel={m.nav_settings()}
		signOutAction={resolve('/logout')}
		signOutLabel={m.sign_out()}
	/>
{/snippet}
{#snippet playerRegion()}
	<Player />
{/snippet}
{#snippet queueAsideActions()}
	<button
		type="button"
		class="flex h-10 w-10 items-center justify-center rounded-(--radius-full) text-(--text-muted) hover:bg-(--surface-selected) hover:text-(--text-primary)"
		onclick={() => player.openPanel('queue')}
		aria-label={m.player_collapse()}
	>
		<X size={18} aria-hidden="true" />
	</button>
{/snippet}
{#snippet queueAside()}
	<AppAside title={m.player_queue()} actions={queueAsideActions}>
		<QueuePanel />
	</AppAside>
{/snippet}

<AppShell
	{navigation}
	header={appHeader}
	aside={queueAside}
	asideLabel={m.player_queue()}
	asideOpen={player.isExpanded && player.panel === 'queue'}
	player={playerRegion}
	currentPath={page.url.pathname}
	skipLinkLabel={m.skip_to_content()}
	navigationLabel={m.nav_primary()}
	userName={data.user.name}
	accountHref={localizeHref(resolve('/app/settings/tidal'))}
	accountLabel={m.nav_settings()}
	signOutAction={resolve('/logout')}
	signOutLabel={m.sign_out()}
	collapseRailLabel={m.nav_collapse()}
	expandRailLabel={m.nav_expand()}
>
	<ConnectTidalNotice
		connection={data.connection}
		settingsHref={localizeHref(resolve('/app/settings/tidal'))}
		hidden={page.url.pathname.includes('/settings/tidal')}
	/>
	{@render children()}
</AppShell>

<PlaylistDialog />
