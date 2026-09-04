<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { locales, localizeHref } from '#lib/paraglide/runtime';
	import AppHeader from '#lib/components/app/AppHeader.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import { themeManager } from '#lib/theme/theme.svelte.js';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	$effect(() => {
		themeManager.init(data.theme, data.visualStyle);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex min-h-dvh flex-col">
	<AppHeader user={data.user} />
	<div class="flex-1">
		{@render children()}
	</div>
	<Footer />
</div>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
