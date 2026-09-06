<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft, CircleCheck, Download, SlidersHorizontal } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	type InstallPromptEvent = Event & {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	let installPrompt = $state<InstallPromptEvent | null>(null);
	let isPromptingInstall = $state(false);
	let isInstalled = $state(false);

	function isStandalone(): boolean {
		return (
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true
		);
	}

	$effect(() => {
		const displayMode = window.matchMedia('(display-mode: standalone)');
		const syncInstalled = () => (isInstalled = isStandalone());
		const captureInstallPrompt = (event: Event) => {
			event.preventDefault();
			installPrompt = event as InstallPromptEvent;
		};
		const markInstalled = () => {
			isInstalled = true;
			installPrompt = null;
		};

		syncInstalled();
		window.addEventListener('beforeinstallprompt', captureInstallPrompt);
		window.addEventListener('appinstalled', markInstalled);
		displayMode.addEventListener('change', syncInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
			window.removeEventListener('appinstalled', markInstalled);
			displayMode.removeEventListener('change', syncInstalled);
		};
	});

	async function install(): Promise<void> {
		if (!installPrompt || isPromptingInstall) return;
		isPromptingInstall = true;
		try {
			await installPrompt.prompt();
			await installPrompt.userChoice;
		} finally {
			isPromptingInstall = false;
		}
	}
</script>

<svelte:head>
	<title>{m.mobile_settings_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.mobile_settings_description()} />
</svelte:head>

<section class="mobile-settings" aria-labelledby="mobile-settings-title">
	<header>
		<a href={resolve('/(mobile)/home')} aria-label={m.mobile_settings_back()}>
			<ChevronLeft size={20} aria-hidden="true" />
		</a>
		<div>
			<h1 id="mobile-settings-title">{m.mobile_settings_title()}</h1>
			<p>{m.mobile_settings_description()}</p>
		</div>
	</header>

	<section class="card" aria-labelledby="mobile-settings-streaming-title">
		<div class="card-heading">
			<SlidersHorizontal size={20} aria-hidden="true" />
			<div>
				<h2 id="mobile-settings-streaming-title">{m.streaming_settings_title()}</h2>
				<p>{m.streaming_settings_description()}</p>
			</div>
		</div>

		{#if form?.streamingSettingsSaved}
			<p class="notice success" role="status">
				<CircleCheck size={18} aria-hidden="true" />{m.streaming_settings_saved()}
			</p>
		{:else if form?.streamingSettingsError}
			<p class="notice error" role="alert">{m.streaming_settings_error()}</p>
		{/if}

		<form method="POST" action="?/saveStreamingSettings">
			<label for="mobile-preferred-quality">
				<span>{m.streaming_quality_label()}</span>
				<select id="mobile-preferred-quality" name="preferredQuality">
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

			<label for="mobile-streaming-volume">
				<span>{m.streaming_volume_label()}</span>
				<input
					id="mobile-streaming-volume"
					name="volume"
					type="range"
					min="0"
					max="100"
					step="1"
					value={data.streamingSettings.volume}
				/>
			</label>

			<label class="check-label" for="mobile-loudness-normalization">
				<input
					id="mobile-loudness-normalization"
					name="loudnessNormalization"
					type="checkbox"
					checked={data.streamingSettings.loudnessNormalization}
				/>
				<span>{m.streaming_normalization_label()}</span>
			</label>

			<button type="submit">{m.streaming_settings_save()}</button>
		</form>
	</section>

	<section class="card connection" aria-labelledby="mobile-settings-connection-title">
		<h2 id="mobile-settings-connection-title">{m.mobile_settings_connection_title()}</h2>
		{#if !data.connection.configured}
			<p>{m.tidal_not_configured()}</p>
		{:else if data.connection.connected}
			<p>{m.mobile_settings_connected()}</p>
			<a class="button" href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		{:else}
			<p>{m.mobile_settings_disconnected()}</p>
			<a class="button" href={resolve('/tidal/connect')}>{m.tidal_connect()}</a>
		{/if}
	</section>

	<section class="card" aria-labelledby="mobile-install-title">
		<div class="card-heading">
			<Download size={20} aria-hidden="true" />
			<div>
				<h2 id="mobile-install-title">{m.mobile_install_title()}</h2>
				<p>{m.mobile_install_description()}</p>
			</div>
		</div>

		{#if isInstalled}
			<p class="notice success" role="status">
				<CircleCheck size={18} aria-hidden="true" />{m.mobile_install_installed()}
			</p>
		{:else if installPrompt}
			<button
				type="button"
				disabled={isPromptingInstall}
				aria-busy={isPromptingInstall}
				onclick={install}
			>
				{m.mobile_install_action()}
			</button>
		{:else}
			<details class="install-help">
				<summary>{m.mobile_install_help_title()}</summary>
				<p>{m.mobile_install_help_description()}</p>
			</details>
		{/if}
	</section>

	<a class="attribution" href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
</section>

<style>
	.mobile-settings {
		max-width: 44rem;
		margin-inline: auto;
		padding: 1rem 1rem 2rem;
	}
	header,
	.card-heading {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}
	header {
		margin-bottom: 1.5rem;
	}
	header > a {
		display: grid;
		width: 3rem;
		height: 3rem;
		flex: 0 0 auto;
		place-items: center;
		color: var(--text-primary);
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	h1 {
		font-size: 1.5rem;
	}
	header p,
	.card-heading p,
	.connection p,
	.attribution {
		margin-top: 0.35rem;
		color: var(--text-muted);
	}
	.card {
		margin-top: 1rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: 1rem;
	}
	.card-heading :global(svg) {
		margin-top: 0.1rem;
		color: var(--action);
	}
	form {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
	}
	label {
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
	}
	select,
	input[type='range'] {
		width: 100%;
		min-height: 3rem;
	}
	select,
	button,
	.button {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-canvas);
		color: var(--text-primary);
		font: inherit;
	}
	.check-label {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-height: 3rem;
	}
	.check-label input {
		width: 1.25rem;
		height: 1.25rem;
	}
	button,
	.button {
		display: inline-flex;
		min-height: 3rem;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.9rem;
		text-decoration: none;
		cursor: pointer;
	}
	button {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
		font-weight: 700;
	}
	.connection .button {
		margin-top: 1rem;
	}
	.card > button,
	.install-help {
		margin-top: 1rem;
	}
	.install-help {
		color: var(--text-muted);
	}
	.install-help summary {
		cursor: pointer;
		font-weight: 700;
		color: var(--text-primary);
	}
	.install-help p {
		margin-top: 0.5rem;
	}
	.notice {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 1rem;
		font-size: 0.9rem;
	}
	.success {
		color: var(--accent-jade);
	}
	.error {
		color: var(--danger);
	}
	.attribution {
		display: inline-block;
		margin: 1.25rem 0.25rem 0;
	}
	a:focus-visible,
	button:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
</style>
