<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';
	import Button from '#lib/components/ui/Button.svelte';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.lastfm_settings_title()} — {m.brand_name()}</title>
</svelte:head>

<section class="lastfm-settings" aria-labelledby="lastfm-title">
	<ViewHeader
		eyebrow={m.view_eyebrow_lastfm()}
		title={m.lastfm_settings_title()}
		titleId="lastfm-title"
		description={m.lastfm_settings_description()}
	/>

	{#if data.notice.connected}
		<Notice tone="success">{m.lastfm_connected_notice()}</Notice>
	{:else if data.notice.disconnected}
		<Notice>{m.lastfm_disconnected_notice()}</Notice>
	{:else if data.notice.error}
		<Notice tone="danger">{m.lastfm_error()}</Notice>
	{/if}

	<section class="connection-card">
		{#if !data.connection.configured}
			<h2>{m.lastfm_unavailable_title()}</h2>
			<p>{m.lastfm_unavailable_description()}</p>
		{:else if data.connection.connected}
			<h2>{m.lastfm_connected_title({ username: data.connection.username ?? '' })}</h2>
			<p>{m.lastfm_connected_description()}</p>
			<form method="POST" action={resolve('/lastfm/disconnect')}>
				<Button type="submit">{m.lastfm_disconnect()}</Button>
			</form>
		{:else}
			<h2>{m.lastfm_connect_title()}</h2>
			<p>{m.lastfm_connect_description()}</p>
			<Button variant="primary" href={resolve('/lastfm/connect')}>{m.lastfm_connect()}</Button>
		{/if}
	</section>
</section>

<style>
	.lastfm-settings {
		max-width: 44rem;
	}
	.connection-card {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		padding: 1.25rem;
	}
	.connection-card h2 {
		margin-top: 0;
	}
	.connection-card p {
		color: var(--text-muted);
	}
</style>
