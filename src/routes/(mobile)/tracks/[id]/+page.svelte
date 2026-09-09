<script lang="ts">
	import MobileTrackDetail from '#lib/components/mobile/MobileTrackDetail.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.track ? `${data.track.title} — ${m.brand_name()}` : m.track_label()}</title>
</svelte:head>

<MobileTrackDetail track={data.track} state={data.state} />
