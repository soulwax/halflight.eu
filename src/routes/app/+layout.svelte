<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import Player from '#lib/components/player/Player.svelte';
	import AddToPlaylistModal from '#lib/components/music/AddToPlaylistModal.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { themeManager } from '#lib/theme/theme.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const navigation = $derived([
		{ href: resolve('/app'), label: m.nav_home() },
		{ href: resolve('/app/generate'), label: m.nav_generate() },
		{ href: resolve('/app/search'), label: m.nav_search() },
		{ href: resolve('/app/library'), label: m.nav_library() },
		{ href: resolve('/app/mixes'), label: m.nav_mixes() },
		{ href: resolve('/app/settings/taste'), label: m.nav_taste() },
		{ href: resolve('/app/settings/lastfm'), label: m.nav_lastfm() }
	]);

	$effect(() => {
		themeManager.init(data.theme, data.visualStyle);
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

<AppShell
	{navigation}
	header={appHeader}
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
