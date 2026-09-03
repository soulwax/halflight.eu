<script lang="ts">
	import { resolve } from '$app/paths';
	import { ExternalLink, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		tidalUrl,
		tidalLabel,
		backHref,
		backLabel,
		retryHref
	}: {
		tidalUrl?: string;
		tidalLabel?: string;
		backHref?: string;
		backLabel?: string;
		retryHref?: string;
	} = $props();

	const defaultBackHref = $derived(backHref ?? resolve('/app/search'));
	const defaultBackLabel = $derived(backLabel ?? m.track_back_to_search());
</script>

<div class="page-actions-bar">
	{#if tidalUrl}
		<a class="btn-base" href={tidalUrl} rel="noreferrer" target="_blank">
			<Play size={14} fill="currentColor" />
			{tidalLabel ?? m.album_open_in_tidal()}
			<ExternalLink size={13} />
		</a>
	{/if}

	{#if retryHref}
		<a class="btn-base" href={retryHref}>
			{m.track_retry()}
		</a>
	{/if}

	<a class="btn-base" href={defaultBackHref}>
		{defaultBackLabel}
	</a>
</div>
