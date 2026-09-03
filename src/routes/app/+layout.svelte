<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import MiniPlayer from '#lib/components/player/MiniPlayer.svelte';
	import QueueDrawer from '#lib/components/player/QueueDrawer.svelte';
	import PlaylistGeneratorModal from '#lib/components/music/PlaylistGeneratorModal.svelte';
	import AddToPlaylistModal from '#lib/components/music/AddToPlaylistModal.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const navigation = $derived([
		{ href: resolve('/app'), label: m.nav_home() },
		{ href: resolve('/app/search'), label: m.nav_search() },
		{ href: resolve('/app/library'), label: m.nav_library() },
		{ href: resolve('/app/mixes'), label: m.nav_mixes() },
		{ href: resolve('/app/settings/tidal'), label: m.nav_settings() }
	]);

	$effect(() => {
		player.applyStreamingSettings(data.streamingSettings);
	});
</script>

<AppShell
	brand={{ href: resolve('/app'), label: 'Syn' }}
	{navigation}
	currentPath={page.url.pathname}
	skipLinkLabel={m.skip_to_content()}
	navigationLabel={m.nav_primary()}
	userName={data.user.name}
	accountHref={resolve('/app/settings/tidal')}
	accountLabel={m.nav_settings()}
	signOutAction={resolve('/logout')}
	signOutLabel={m.sign_out()}
>
	{@render children()}
</AppShell>

<MiniPlayer />
<QueueDrawer />
<PlaylistGeneratorModal />
<AddToPlaylistModal />
