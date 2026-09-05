<script lang="ts">
	import MobileLibrary from '#lib/components/mobile/MobileLibrary.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.now_tab_library()} — {m.brand_name()}</title>
	<meta name="description" content={m.now_library_description()} />
</svelte:head>

<MobileLibrary {data} />
