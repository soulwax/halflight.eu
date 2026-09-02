<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '#lib/paraglide/runtime';
	import Footer from '#lib/components/Footer.svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex min-h-dvh flex-col">
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
