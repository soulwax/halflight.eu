<script lang="ts">
	import MobileAlbumDetail from '#lib/components/mobile/MobileAlbumDetail.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.album ? `${data.album.title} — ${m.brand_name()}` : m.album_label()}</title>
</svelte:head>

<MobileAlbumDetail album={data.album} state={data.state} />
