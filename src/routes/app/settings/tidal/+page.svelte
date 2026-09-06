<script lang="ts">
	import { resolve } from '$app/paths';
	import { Check, ExternalLink, Loader2, Music, Sparkles } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const status = $derived(data.status);
	const hasFullPlayback = $derived(data.hasFullPlayback);

	let deviceLoading = $state(false);
	let deviceData = $state<{
		deviceCode: string;
		userCode: string;
		verificationUri: string;
		verificationUriComplete: string;
		expiresIn: number;
		interval: number;
	} | null>(null);
	let deviceStatus = $state<'idle' | 'authorizing' | 'success' | 'expired' | 'error'>('idle');
	let deviceError = $state<string | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	async function startDeviceAuth() {
		deviceLoading = true;
		deviceError = null;
		deviceStatus = 'idle';

		try {
			const res = await fetch('/api/tidal/device-auth', { method: 'POST' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to request device authorization');
			}

			deviceData = await res.json();
			deviceStatus = 'authorizing';
			deviceLoading = false;

			if (pollTimer) clearInterval(pollTimer);
			const intervalMs = Math.max((deviceData?.interval || 2) * 1000, 2000);

			pollTimer = setInterval(() => void pollDeviceAuthorization(), intervalMs);
		} catch (err) {
			deviceLoading = false;
			deviceStatus = 'error';
			deviceError = err instanceof Error ? err.message : 'Unknown error';
		}
	}

	async function pollDeviceAuthorization() {
		if (!deviceData?.deviceCode) return;
		try {
			const pollRes = await fetch('/api/tidal/device-auth/poll', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deviceCode: deviceData.deviceCode })
			});
			const pollData = await pollRes.json();
			if (pollData.status === 'success') {
				if (pollTimer) clearInterval(pollTimer);
				deviceStatus = 'success';
				setTimeout(() => {
					window.location.href = resolve('/app/settings/tidal?connected=1');
				}, 1000);
			} else if (pollData.status === 'expired') {
				if (pollTimer) clearInterval(pollTimer);
				deviceStatus = 'expired';
			}
		} catch {
			// continue polling
		}
	}
</script>

<svelte:head>
	<title>{m.tidal_settings_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.tidal_settings_subtitle()} />
</svelte:head>

<section class="tidal-settings" aria-labelledby="tidal-settings-title">
	<header class="settings-header">
		<p class="eyebrow">HALFLIGHT // SYSTEM CONFIGURATION</p>
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
			<div class="card-indicator indicator-red"></div>
			<p class="status-label status-problem">{m.tidal_settings_attention()}</p>
			<h2 id="configuration-title">{m.tidal_settings_configuration_title()}</h2>
			<p>{m.tidal_settings_configuration_description()}</p>
			{#if status.configError}
				<p class="technical-detail">{status.configError}</p>
			{/if}
		</section>
	{:else if status.error}
		<section class="connection-card" aria-labelledby="connection-error-title">
			<div class="card-indicator indicator-red"></div>
			<p class="status-label status-problem">{m.tidal_settings_attention()}</p>
			<h2 id="connection-error-title">{m.tidal_settings_saved_connection_title()}</h2>
			<p>{m.tidal_settings_saved_connection_description()}</p>
			<a class="button" href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if status.connected}
		<section class="connection-card" aria-labelledby="connected-title">
			<div class="card-indicator indicator-blue"></div>
			<p class="status-label status-connected">{m.tidal_connected()}</p>
			<h2 id="connected-title">{m.tidal_settings_connected_title()}</h2>
			<p>{m.tidal_settings_connected_description()}</p>

			{#if !status.hasWriteScopes}
				<p class="notice notice-warning" role="alert">{m.playlist_reconnect_write()}</p>
			{/if}

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
			<div class="card-indicator indicator-yellow"></div>
			<p class="status-label">{m.tidal_not_connected()}</p>
			<h2 id="connect-title">{m.tidal_settings_connect_title()}</h2>
			<p>{m.tidal_settings_connect_description()}</p>
			<a class="button" href={resolve('/tidal/connect')}>{m.tidal_connect()}</a>
		</section>
	{/if}

	<!-- Full Song Playback (TIDAL Link) Card -->
	<section class="device-auth-card" aria-labelledby="device-auth-title">
		<div class="device-auth-header">
			<Music size={22} class="text-[var(--action)]" />
			<div>
				<h2 id="device-auth-title">{m.tidal_device_auth_title()}</h2>
				<p>{m.tidal_device_auth_desc()}</p>
			</div>
		</div>

		<div class="playback-badge-row">
			{#if hasFullPlayback}
				<span class="playback-status-pill pill-active">
					<Check size={13} />
					{m.tidal_playback_full_active()}
				</span>
			{:else}
				<span class="playback-status-pill pill-standard">
					{m.tidal_playback_standard_only()}
				</span>
			{/if}
		</div>

		{#if deviceStatus === 'authorizing' && deviceData}
			<div class="device-prompt-box">
				<p class="prompt-text">{m.tidal_device_auth_prompt()}</p>
				<div class="code-banner">
					<span class="user-code">{deviceData.userCode}</span>
				</div>
				<div class="device-actions">
					<a
						class="button"
						href={`https://${deviceData.verificationUriComplete}`}
						target="_blank"
						rel="noreferrer"
					>
						<ExternalLink size={15} class="mr-1.5" />
						{m.tidal_device_auth_open()}
					</a>
				</div>
				<p class="waiting-text">
					<Loader2 size={14} class="mr-1 inline animate-spin" />
					{m.tidal_device_auth_waiting()}
				</p>
			</div>
		{:else if deviceStatus === 'success'}
			<p class="notice notice-success">{m.tidal_device_auth_success()}</p>
		{:else}
			<div class="device-actions mt-3">
				<button type="button" class="button" disabled={deviceLoading} onclick={startDeviceAuth}>
					{#if deviceLoading}
						<Loader2 size={15} class="mr-1.5 animate-spin" />
					{:else}
						<Sparkles size={15} class="mr-1.5" />
					{/if}
					{m.tidal_device_auth_btn()}
				</button>
			</div>
			{#if deviceError}
				<p class="notice notice-error mt-2">{deviceError}</p>
			{/if}
		{/if}
	</section>

	<section class="streaming-settings-card" aria-labelledby="streaming-settings-title">
		<div>
			<h2 id="streaming-settings-title">{m.streaming_settings_title()}</h2>
			<p>{m.streaming_settings_description()}</p>
		</div>

		{#if form?.streamingSettingsSaved}
			<p class="notice notice-success" role="status">{m.streaming_settings_saved()}</p>
		{:else if form?.streamingSettingsError}
			<p class="notice notice-error" role="alert">{m.streaming_settings_error()}</p>
		{/if}

		<form method="POST" action="?/saveStreamingSettings" class="streaming-settings-form">
			<label for="preferred-quality">
				<span>{m.streaming_quality_label()}</span>
				<select id="preferred-quality" name="preferredQuality">
					<option value="LOW" selected={data.streamingSettings.preferredQuality === 'LOW'}>
						{m.streaming_quality_low()}
					</option>
					<option value="HIGH" selected={data.streamingSettings.preferredQuality === 'HIGH'}>
						{m.streaming_quality_high()}
					</option>
					<option
						value="LOSSLESS"
						selected={data.streamingSettings.preferredQuality === 'LOSSLESS'}
					>
						{m.streaming_quality_lossless()}
					</option>
					<option
						value="HI_RES_LOSSLESS"
						selected={data.streamingSettings.preferredQuality === 'HI_RES_LOSSLESS'}
					>
						{m.streaming_quality_hires()}
					</option>
				</select>
			</label>

			<label for="streaming-volume">
				<span>{m.streaming_volume_label()}</span>
				<input
					id="streaming-volume"
					name="volume"
					type="range"
					min="0"
					max="100"
					step="1"
					value={data.streamingSettings.volume}
				/>
			</label>

			<label class="check-label" for="loudness-normalization">
				<input
					id="loudness-normalization"
					name="loudnessNormalization"
					type="checkbox"
					checked={data.streamingSettings.loudnessNormalization}
				/>
				<span>{m.streaming_normalization_label()}</span>
			</label>

			<button class="button" type="submit">{m.streaming_settings_save()}</button>
		</form>
	</section>

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

	.settings-header {
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 1.5rem;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.2rem, 5vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.intro {
		margin: 0.75rem 0 0;
		color: var(--text-muted);
		font-size: 1.05rem;
	}

	.notice,
	.connection-card,
	.info-card,
	.streaming-settings-card {
		position: relative;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
		overflow: hidden;
	}

	.card-indicator {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
	}

	.indicator-blue {
		background: var(--action);
	}
	.indicator-yellow {
		background: var(--accent-gold);
	}
	.indicator-red {
		background: var(--danger);
	}

	.device-auth-card {
		position: relative;
		margin-top: 1.5rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-md, 10px);
		background: var(--surface-raised);
		padding: 1.75rem;
	}

	.device-auth-header {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		margin-bottom: 1.25rem;
	}

	.device-auth-header h2 {
		margin: 0 0 0.35rem;
		font-size: 1.15rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.device-auth-header p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.playback-badge-row {
		margin-bottom: 1rem;
	}

	.playback-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-sm, 6px);
		border: 1px solid var(--border-strong);
	}

	.pill-active {
		background: var(--surface-sunken);
		color: var(--action);
		border-color: var(--action);
	}

	.pill-standard {
		background: var(--surface-canvas);
		color: var(--text-muted);
	}

	.device-prompt-box {
		margin-top: 1rem;
		padding: 1.25rem;
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-sunken);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
	}

	.prompt-text {
		margin: 0;
		font-size: 0.88rem;
		color: var(--text-primary);
	}

	.code-banner {
		padding: 0.75rem 1.5rem;
		background: var(--surface-canvas);
		border: 2px dashed var(--action);
		border-radius: var(--radius-sm, 6px);
	}

	.user-code {
		font-family: var(--font-mono, monospace);
		font-size: 1.75rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--action);
	}

	.waiting-text {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-family: var(--font-mono, monospace);
	}

	.notice {
		margin-bottom: 1.5rem;
		border-radius: var(--radius-sm, 6px);
		color: var(--text-muted);
	}

	.notice-success {
		border-color: var(--action);
		border-left-width: 4px;
		color: var(--text-primary);
	}

	.notice-error {
		border-color: var(--danger);
		background: var(--danger-subtle);
		color: var(--danger);
		font-weight: 700;
	}

	.connection-card h2,
	.info-card h2,
	.streaming-settings-card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.35rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.connection-card > p:not(.status-label):not(.refresh-note):not(.technical-detail),
	.info-card p {
		margin: 0 0 1.25rem;
		color: var(--text-muted);
		line-height: 1.55;
	}

	.status-label {
		margin: 0 0 0.75rem;
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.1em;
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
		min-height: 2.85rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		padding: 0.6rem 1.25rem;
		color: var(--action-contrast);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.button:hover {
		box-shadow: var(--shadow-panel);
		transform: translate(-1px, -1px);
	}

	.button-secondary {
		border: 2px solid var(--border-strong);
		background: transparent;
		color: var(--text-primary);
	}

	.button-secondary:hover {
		background: var(--surface-selected);
	}

	.refresh-note,
	.technical-detail {
		margin-bottom: 1.25rem;
		border-left: 3px solid var(--border-strong);
		padding-left: 0.75rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.technical-detail {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
	}

	.info-card {
		margin-top: 1.5rem;
	}

	.streaming-settings-card {
		margin-top: 1.5rem;
	}

	.streaming-settings-card > div > p {
		margin: 0.5rem 0 0;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.streaming-settings-form {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.streaming-settings-form label {
		display: grid;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.streaming-settings-form select,
	.streaming-settings-form input[type='range'] {
		width: 100%;
	}

	.streaming-settings-form select {
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		padding: 0.65rem 0.75rem;
		color: var(--text-primary);
		font: inherit;
	}

	.streaming-settings-form .check-label {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		text-transform: none;
	}

	.check-label input {
		width: 1rem;
		height: 1rem;
	}

	.info-card p {
		margin-bottom: 0;
	}

	.attribution {
		margin: 2.5rem 0 0;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}
</style>
