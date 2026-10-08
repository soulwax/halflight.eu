<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { chooseSite, rememberSiteChoice } from '#lib/mobile/site-entry';
	import { m } from '#lib/paraglide/messages.js';

	onMount(() => {
		// A first TIDAL sign-in lands here with `welcome`: finish setup (TIDAL Link)
		// on whichever shell this device uses.
		const welcome = new URL(window.location.href).searchParams.has('welcome');
		const mobile = chooseSite(document.cookie, window.innerWidth) === 'mobile';
		const destination = welcome
			? mobile
				? resolve('/(mobile)/settings')
				: `${resolve('/app/settings/tidal')}?welcome=1`
			: mobile
				? resolve('/(mobile)/home')
				: resolve('/app');
		window.location.replace(destination);
	});
</script>

<main class="site-entry" aria-live="polite">
	<p>{m.site_opening()}</p>
	<a href={resolve('/(mobile)/home')} onclick={() => rememberSiteChoice('mobile')}
		>{m.site_mobile_view()}</a
	>
	<a href={resolve('/app')} onclick={() => rememberSiteChoice('desktop')}>{m.site_desktop_view()}</a
	>
</main>

<style>
	.site-entry {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
		color: var(--text-primary);
	}
	.site-entry a {
		color: var(--action);
	}
</style>
