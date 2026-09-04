<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.lastfm_settings_title()} — {m.brand_name()}</title>
</svelte:head>

<section class="lastfm-settings" aria-labelledby="lastfm-title">
	<header>
		<p class="eyebrow">SYN // LAST.FM</p>
		<h1 id="lastfm-title">{m.lastfm_settings_title()}</h1>
		<p>{m.lastfm_settings_description()}</p>
	</header>

	{#if data.notice.connected}
		<p class="notice success" role="status">{m.lastfm_connected_notice()}</p>
	{:else if data.notice.disconnected}
		<p class="notice" role="status">{m.lastfm_disconnected_notice()}</p>
	{:else if data.notice.error}
		<p class="notice error" role="alert">{m.lastfm_error()}</p>
	{/if}

	<section class="connection-card">
		{#if !data.connection.configured}
			<h2>{m.lastfm_unavailable_title()}</h2>
			<p>{m.lastfm_unavailable_description()}</p>
		{:else if data.connection.connected}
			<h2>{m.lastfm_connected_title({ username: data.connection.username ?? '' })}</h2>
			<p>{m.lastfm_connected_description()}</p>
			<form method="POST" action={resolve('/lastfm/disconnect')}>
				<button type="submit" class="secondary">{m.lastfm_disconnect()}</button>
			</form>
		{:else}
			<h2>{m.lastfm_connect_title()}</h2>
			<p>{m.lastfm_connect_description()}</p>
			<a class="button" href={resolve('/lastfm/connect')}>{m.lastfm_connect()}</a>
		{/if}
	</section>
</section>

<style>
	.lastfm-settings {
		max-width: 44rem;
	}
	header {
		margin-bottom: 2rem;
	}
	h1 {
		margin: 0.25rem 0 0.5rem;
	}
	header p:last-child {
		color: var(--text-muted);
	}
	.connection-card,
	.notice {
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
	.button,
	button {
		display: inline-block;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.7rem 1rem;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}
	.secondary {
		background: transparent;
		border: 1px solid var(--border-strong);
		color: var(--text-primary);
	}
	.notice {
		margin-bottom: 1rem;
	}
	.success {
		color: var(--success);
	}
	.error {
		color: var(--danger);
	}
</style>
