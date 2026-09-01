<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const navigation = $derived([
		{ href: resolve('/app'), label: m.nav_home() },
		{ href: resolve('/app/search'), label: m.nav_search() },
		{ href: resolve('/app/settings/tidal'), label: m.nav_settings() }
	]);
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
>
	{@render children()}
</AppShell>
