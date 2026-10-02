<script lang="ts">
	import { resolve } from '$app/paths';
	import TidalPlaybackSetup from '#lib/components/tidal/TidalPlaybackSetup.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import TidalDebugTokens from '#lib/components/tidal/TidalDebugTokens.svelte';

	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const status = $derived(data.status);
	const hasFullPlayback = $derived(data.hasFullPlayback);

	let advancedOpen = $state(false);
</script>

<svelte:head>
	<title>{m.tidal_settings_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.tidal_settings_subtitle()} />
</svelte:head>

<section class="tidal-settings" aria-labelledby="tidal-settings-title">
	<ViewHeader
		eyebrow={m.view_eyebrow_tidal()}
		title={m.tidal_settings_title()}
		titleId="tidal-settings-title"
		description={m.tidal_settings_subtitle()}
	/>

	{#if data.notice.error}
		<Notice tone="danger">{m.tidal_settings_connection_failed()}</Notice>
	{:else if data.notice.connected}
		<Notice tone="success">{m.tidal_settings_connected_notice()}</Notice>
	{:else if data.notice.disconnected}
		<Notice>{m.tidal_settings_disconnected_notice()}</Notice>
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
			<Button variant="primary" href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</Button>
		</section>
	{:else if status.connected}
		<section class="connection-card" aria-labelledby="connected-title">
			<div class="card-indicator indicator-blue"></div>
			<p class="status-label status-connected">{m.tidal_connected()}</p>
			<h2 id="connected-title">{m.tidal_settings_connected_title()}</h2>
			<p>{m.tidal_settings_connected_description()}</p>

			{#if !status.hasWriteScopes}
				<Notice tone="warning">{m.playlist_reconnect_write()}</Notice>
			{/if}

			{#if status.stale}
				<p class="refresh-note">{m.tidal_settings_refreshing()}</p>
			{/if}

			<div class="actions">
				<Button variant="primary" href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</Button>
				<form method="POST" action={resolve('/tidal/disconnect')}>
					<Button type="submit">{m.tidal_disconnect()}</Button>
				</form>
			</div>
		</section>
	{:else}
		<section class="connection-card" aria-labelledby="connect-title">
			<div class="card-indicator indicator-yellow"></div>
			<p class="status-label">{m.tidal_not_connected()}</p>
			<h2 id="connect-title">{m.tidal_settings_connect_title()}</h2>
			<p>{m.tidal_settings_connect_description()}</p>
			<Button variant="primary" href={resolve('/tidal/connect')}>{m.tidal_connect()}</Button>
		</section>
	{/if}

	{#if status.connected}
		<details bind:open={advancedOpen}>
			<summary>{m.settings_advanced()}</summary>{#if advancedOpen}<TidalDebugTokens />{/if}
		</details>
	{/if}

	<TidalPlaybackSetup configured={status.configured} hasPlayback={hasFullPlayback} />

	<section class="streaming-settings-card" aria-labelledby="streaming-settings-title">
		<div>
			<h2 id="streaming-settings-title">{m.streaming_settings_title()}</h2>
			<p>{m.streaming_settings_description()}</p>
			<p>{m.streaming_settings_next_track()}</p>
		</div>

		{#if form?.streamingSettingsSaved}
			<Notice tone="success">{m.streaming_settings_saved()}</Notice>
		{:else if form?.streamingSettingsError}
			<Notice tone="danger">{m.streaming_settings_error()}</Notice>
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

			<Button variant="primary" type="submit">{m.streaming_settings_save()}</Button>
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

	.connection-card,
	.info-card,
	.streaming-settings-card {
		position: relative;
		border: var(--module-border);
		border-radius: var(--module-radius);
		background: var(--module-bg);
		box-shadow: var(--module-shadow);
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
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
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
