<script lang="ts">
	import MobileArtistDetail from '#lib/components/mobile/MobileArtistDetail.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.artist ? `${data.artist.name} — ${m.brand_name()}` : m.artist_label()}</title>
</svelte:head>

<MobileArtistDetail artist={data.artist} state={data.state} />
