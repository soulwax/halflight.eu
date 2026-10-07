<script lang="ts">
	import MobilePlaylistDetail from '#lib/components/mobile/MobilePlaylistDetail.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.playlist ? `${data.playlist.title} — ${m.brand_name()}` : m.now_tab_library()}</title
	>
</svelte:head>

<MobilePlaylistDetail
	playlist={data.playlist}
	state={data.state}
	isLocal={data.isLocal}
	editVersion={data.editVersion}
	editTracks={data.editTracks}
/>
