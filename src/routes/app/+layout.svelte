<script lang="ts">
	import AppAside from '#lib/components/app/AppAside.svelte';
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import AddToPlaylistModal from '#lib/components/music/AddToPlaylistModal.svelte';
	import QueuePanel from '#lib/components/player/panels/QueuePanel.svelte';
	import Player from '#lib/components/player/Player.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime';
	import { player } from '#lib/player/player.svelte.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Disc3, Home, Library, Radio, Search, Sparkles, Waves } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const navigation = $derived([
		{ href: localizeHref(resolve('/app')), label: m.nav_home(), icon: Home },
		{ href: localizeHref(resolve('/app/generate')), label: m.nav_generate(), icon: Sparkles },
		{ href: localizeHref(resolve('/app/search')), label: m.nav_search(), icon: Search },
		{ href: localizeHref(resolve('/app/library')), label: m.nav_library(), icon: Library },
		{ href: localizeHref(resolve('/app/mixes')), label: m.nav_mixes(), icon: Disc3 },
		{ href: localizeHref(resolve('/app/settings/taste')), label: m.nav_taste(), icon: Waves },
		{ href: localizeHref(resolve('/app/settings/lastfm')), label: m.nav_lastfm(), icon: Radio }
	]);

	$effect(() => {
		player.applyStreamingSettings(data.streamingSettings);
		player.restorePlaybackState(data.playbackState);
	});
</script>

{#snippet appHeader()}
	<AppHeader user={data.user} />
{/snippet}
{#snippet playerRegion()}
	<Player />
{/snippet}
{#snippet footerRegion()}
	<Footer />
{/snippet}
{#snippet queueAside()}
	<AppAside title={m.player_queue()}>
		<QueuePanel />
	</AppAside>
{/snippet}

<AppShell
	{navigation}
	header={appHeader}
	aside={queueAside}
	asideLabel={m.player_queue()}
	player={playerRegion}
	footer={footerRegion}
	currentPath={page.url.pathname}
	skipLinkLabel={m.skip_to_content()}
	navigationLabel={m.nav_primary()}
	userName={data.user.name}
	signOutAction={resolve('/logout')}
	signOutLabel={m.sign_out()}
	collapseRailLabel={m.nav_collapse()}
	expandRailLabel={m.nav_expand()}
>
	{@render children()}
</AppShell>

<AddToPlaylistModal />
