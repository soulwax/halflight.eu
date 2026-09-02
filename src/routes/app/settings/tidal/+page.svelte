<script lang="ts">
	import { resolve } from '$app/paths';
	import { Check, Copy, Key } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const status = $derived(data.status);
	const debugTokens = $derived(data.debugTokens);

	let copiedAccess = $state(false);
	let copiedRefresh = $state(false);

	async function copyAccessToken() {
		if (!debugTokens?.accessToken) return;
		await navigator.clipboard.writeText(debugTokens.accessToken);
		copiedAccess = true;
		setTimeout(() => {
			copiedAccess = false;
		}, 2000);
	}

	async function copyRefreshToken() {
		if (!debugTokens?.refreshToken) return;
		await navigator.clipboard.writeText(debugTokens.refreshToken);
		copiedRefresh = true;
		setTimeout(() => {
			copiedRefresh = false;
		}, 2000);
	}
</script>

<svelte:head>
	<title>{m.tidal_settings_title()} — Syn</title>
	<meta name="description" content={m.tidal_settings_subtitle()} />
</svelte:head>

<section class="tidal-settings" aria-labelledby="tidal-settings-title">
	<header>
		<p class="eyebrow">TIDAL</p>
		<h1 id="tidal-settings-title">{m.tidal_settings_title()}</h1>
		<p class="intro">{m.tidal_settings_subtitle()}</p>
	</header>

	{#if data.notice.error}
		<p class="notice notice-error" role="alert">{m.tidal_settings_connection_failed()}</p>
	{:else if data.notice.connected}
		<p class="notice notice-success" role="status">{m.tidal_settings_connected_notice()}</p>
	{:else if data.notice.disconnected}
		<p class="notice" role="status">{m.tidal_settings_disconnected_notice()}</p>
	{/if}

	{#if !status.configured}
		<section class="connection-card" aria-labelledby="configuration-title">
			<p class="status-label status-problem">{m.tidal_settings_attention()}</p>
			<h2 id="configuration-title">{m.tidal_settings_configuration_title()}</h2>
			<p>{m.tidal_settings_configuration_description()}</p>
			{#if status.configError}
				<p class="technical-detail">{status.configError}</p>
			{/if}
		</section>
	{:else if status.error}
		<section class="connection-card" aria-labelledby="connection-error-title">
			<p class="status-label status-problem">{m.tidal_settings_attention()}</p>
			<h2 id="connection-error-title">{m.tidal_settings_saved_connection_title()}</h2>
			<p>{m.tidal_settings_saved_connection_description()}</p>
			<a class="button" href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if status.connected}
		<section class="connection-card" aria-labelledby="connected-title">
			<p class="status-label status-connected">{m.tidal_connected()}</p>
			<h2 id="connected-title">{m.tidal_settings_connected_title()}</h2>
			<p>{m.tidal_settings_connected_description()}</p>

			{#if status.stale}
				<p class="refresh-note">{m.tidal_settings_refreshing()}</p>
			{/if}

			<div class="actions">
				<a class="button" href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
				<form method="POST" action={resolve('/tidal/disconnect')}>
					<button class="button button-secondary" type="submit">{m.tidal_disconnect()}</button>
				</form>
			</div>
		</section>
	{:else}
		<section class="connection-card" aria-labelledby="connect-title">
			<p class="status-label">{m.tidal_not_connected()}</p>
			<h2 id="connect-title">{m.tidal_settings_connect_title()}</h2>
			<p>{m.tidal_settings_connect_description()}</p>
			<a class="button" href={resolve('/tidal/connect')}>{m.tidal_connect()}</a>
		</section>
	{/if}

	{#if debugTokens}
		<section class="debug-card" aria-labelledby="debug-title">
			<div class="debug-header">
				<Key size={20} />
				<div>
					<h2 id="debug-title">{m.tidal_settings_debug_title()}</h2>
					<p>{m.tidal_settings_debug_description()}</p>
				</div>
			</div>

			<div class="token-group">
				<div class="token-label-row">
					<label for="access-token-input">{m.tidal_settings_debug_access_token()}</label>
					<button type="button" class="copy-button" onclick={copyAccessToken}>
						{#if copiedAccess}
							<Check size={14} /> {m.tidal_settings_debug_copied()}
						{:else}
							<Copy size={14} /> {m.tidal_settings_debug_copy()}
						{/if}
					</button>
				</div>
				<input
					id="access-token-input"
					type="password"
					readonly
					value={debugTokens.accessToken}
					class="token-input"
				/>
			</div>

			<div class="token-group">
				<div class="token-label-row">
					<label for="refresh-token-input">{m.tidal_settings_debug_refresh_token()}</label>
					<button type="button" class="copy-button" onclick={copyRefreshToken}>
						{#if copiedRefresh}
							<Check size={14} /> {m.tidal_settings_debug_copied()}
						{:else}
							<Copy size={14} /> {m.tidal_settings_debug_copy()}
						{/if}
					</button>
				</div>
				<input
					id="refresh-token-input"
					type="password"
					readonly
					value={debugTokens.refreshToken}
					class="token-input"
				/>
			</div>

			<p class="debug-warning">{m.tidal_settings_debug_warning()}</p>
		</section>
	{/if}

	<section class="info-card" aria-labelledby="privacy-title">
		<h2 id="privacy-title">{m.tidal_settings_privacy_title()}</h2>
		<p>{m.tidal_settings_privacy_description()}</p>
	</section>

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.tidal-settings {
		max-width: 48rem;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1 {
		margin-bottom: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.intro {
		margin: 0.75rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.notice,
	.connection-card,
	.info-card,
	.debug-card {
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.debug-card {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.debug-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.debug-header h2 {
		margin-bottom: 0.25rem;
		font-size: 1.2rem;
	}

	.debug-header p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.token-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.token-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.token-label-row label {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.copy-button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		background: var(--surface-canvas);
		padding: 0.25rem 0.6rem;
		color: var(--text-primary);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.copy-button:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.token-input {
		width: 100%;
		border: 1px solid var(--border-subtle);
		border-radius: 0.65rem;
		background: var(--surface-canvas);
		padding: 0.6rem 0.75rem;
		color: var(--text-primary);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
	}

	.debug-warning {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-style: italic;
	}

	.notice {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.notice-success {
		border-color: color-mix(in oklab, var(--action), var(--border-subtle) 55%);
		color: var(--text-primary);
	}

	.notice-error {
		border-color: var(--danger);
		background: var(--danger-subtle);
		color: var(--text-primary);
	}

	.connection-card h2,
	.info-card h2 {
		margin-bottom: 0.5rem;
		font-size: 1.35rem;
	}

	.connection-card > p:not(.status-label):not(.refresh-note):not(.technical-detail),
	.info-card p {
		margin-bottom: 1.25rem;
		color: var(--text-muted);
		line-height: 1.55;
	}

	.status-label {
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.status-connected {
		color: var(--action);
	}

	.status-problem {
		color: var(--danger);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.button {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}

	.button-secondary {
		border: 1px solid var(--border-strong);
		background: transparent;
		color: var(--text-primary);
	}

	.refresh-note,
	.technical-detail {
		margin-bottom: 1.25rem;
		border-left: 3px solid var(--border-strong);
		padding-left: 0.75rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.technical-detail {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8rem;
	}

	.info-card {
		margin-top: 1rem;
	}

	.info-card p {
		margin-bottom: 0;
	}

	.attribution {
		margin: 1.5rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.attribution a {
		color: inherit;
	}
</style>
