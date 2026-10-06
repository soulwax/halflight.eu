<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { CircleCheck, Download, Palette, SlidersHorizontal } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import MobileSubScreenHeader from '#lib/components/mobile/MobileSubScreenHeader.svelte';
	import TidalPlaybackSetup from '#lib/components/tidal/TidalPlaybackSetup.svelte';
	import { getThemeLabel, type Theme } from '#lib/theme.js';
	import { rememberSiteChoice } from '#lib/mobile/site-entry';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	const selectedTheme = $derived<Theme>(form?.theme ?? data.theme);

	function previewTheme(theme: Theme): void {
		document.documentElement.dataset.theme = theme;
	}

	type InstallPromptEvent = Event & {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	let installPrompt = $state<InstallPromptEvent | null>(null);
	let isPromptingInstall = $state(false);
	let isInstalled = $state(false);
	const mobileQuality = $derived(
		data.streamingSettings.preferredQuality === 'LOW'
			? 'LOW'
			: data.streamingSettings.preferredQuality === 'HIGH'
				? 'HIGH'
				: 'HI_RES_LOSSLESS'
	);

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
	<MobileSubScreenHeader
		backHref={resolve('/(mobile)/home')}
		backLabel={m.mobile_settings_back()}
		heading={m.mobile_settings_title()}
		lead={m.mobile_settings_description()}
		headingId="mobile-settings-title"
	/>
	<section class="card" aria-labelledby="site-choice-title">
		<h2 id="site-choice-title">{m.site_switch_view()}</h2>
		<a class="button" href={resolve('/app')} onclick={() => rememberSiteChoice('desktop')}
			>{m.site_desktop_view()}</a
		>
	</section>

	<section class="card connection" aria-labelledby="mobile-settings-connection-title">
		<h2 id="mobile-settings-connection-title">{m.mobile_settings_connection_title()}</h2>
		{#if page.url.searchParams.has('error')}<p class="notice error" role="alert">
				{m.tidal_settings_connection_failed()}
			</p>
		{:else if page.url.searchParams.has('connected')}<p class="notice success" role="status">
				{m.tidal_settings_connected_notice()}
			</p>
		{:else if page.url.searchParams.has('disconnected')}<p class="notice" role="status">
				{m.tidal_settings_disconnected_notice()}
			</p>{/if}
		{#if !data.connection.configured}
			<p>{m.tidal_not_configured()}</p>
		{:else if data.connection.connected}
			<p>{m.mobile_settings_connected()}</p>
			<a class="button" href={resolve('/tidal/connect?returnTo=/settings')}>{m.tidal_reconnect()}</a
			>
		{:else}
			<p>{m.mobile_settings_disconnected()}</p>
			<a class="button" href={resolve('/tidal/connect?returnTo=/settings')}>{m.tidal_connect()}</a>
		{/if}
	</section>

	<TidalPlaybackSetup
		configured={data.connection.configured}
		hasPlayback={data.connection.hasPlayback}
	/>
	<section class="card" aria-labelledby="mobile-settings-streaming-title">
		<div class="card-heading">
			<SlidersHorizontal size={20} aria-hidden="true" />
			<div>
				<h2 id="mobile-settings-streaming-title">{m.streaming_settings_title()}</h2>
				<p>{m.streaming_settings_description()}</p>
				<p>{m.streaming_settings_next_track()}</p>
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
			<fieldset class="quality-choices" aria-describedby="mobile-quality-note">
				<legend>{m.mobile_quality_mode_label()}</legend>
				<label class:chosen={mobileQuality === 'LOW'}>
					<input
						type="radio"
						name="preferredQuality"
						value="LOW"
						checked={mobileQuality === 'LOW'}
						aria-label={m.mobile_quality_data_saver()}
					/>
					<span>
						<strong>{m.mobile_quality_data_saver()}</strong>
						<small>{m.mobile_quality_data_saver_description()}</small>
					</span>
				</label>
				<label class:chosen={mobileQuality === 'HIGH'}>
					<input
						type="radio"
						name="preferredQuality"
						value="HIGH"
						checked={mobileQuality === 'HIGH'}
						aria-label={m.mobile_quality_balanced()}
					/>
					<span>
						<strong>{m.mobile_quality_balanced()}</strong>
						<small>{m.mobile_quality_balanced_description()}</small>
					</span>
				</label>
				<label class:chosen={mobileQuality === 'HI_RES_LOSSLESS'}>
					<input
						type="radio"
						name="preferredQuality"
						value="HI_RES_LOSSLESS"
						checked={mobileQuality === 'HI_RES_LOSSLESS'}
						aria-label={m.mobile_quality_best_available()}
					/>
					<span>
						<strong>{m.mobile_quality_best_available()}</strong>
						<small>{m.mobile_quality_best_available_description()}</small>
					</span>
				</label>
			</fieldset>
			<p id="mobile-quality-note" class="quality-note">{m.mobile_quality_actual_note()}</p>

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

	<section class="card" aria-labelledby="mobile-settings-appearance-title">
		<div class="card-heading">
			<Palette size={20} aria-hidden="true" />
			<div>
				<h2 id="mobile-settings-appearance-title">{m.appearance_settings_title()}</h2>
				<p>{m.appearance_settings_description()}</p>
			</div>
		</div>

		{#if form?.themeSaved}
			<p class="notice success" role="status">
				<CircleCheck size={18} aria-hidden="true" />{m.appearance_saved_notice()}
			</p>
		{:else if form?.themeError}
			<p class="notice error" role="alert">{m.appearance_error_notice()}</p>
		{/if}

		<form method="POST" action="?/saveTheme">
			<fieldset class="quality-choices">
				<legend>{m.appearance_theme_legend()}</legend>
				{#each data.themes as theme (theme)}
					{@const label = getThemeLabel(theme)}
					<label class:chosen={selectedTheme === theme}>
						<input
							type="radio"
							name="theme"
							value={theme}
							checked={selectedTheme === theme}
							onchange={() => previewTheme(theme)}
							aria-label={label.name}
						/>
						<span
							class="theme-swatch"
							data-theme={theme}
							role="img"
							aria-label={m.theme_preview_label({ theme: label.name })}
						></span>
						<span>
							<strong>{label.name}</strong>
							<small>{label.description}</small>
						</span>
					</label>
				{/each}
			</fieldset>

			<button type="submit">{m.appearance_save()}</button>
		</form>
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
		padding: clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2rem, 8vw, 3rem);
	}
	.card-heading {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}
	h2,
	p {
		margin: 0;
	}
	.card-heading p,
	.connection p,
	.attribution {
		margin-top: 0.35rem;
		color: var(--text-muted);
	}
	.card {
		margin-top: 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		padding: 1.15rem;
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
	fieldset {
		min-width: 0;
		border: 0;
		padding: 0;
	}
	legend {
		margin-bottom: 0.45rem;
		font-weight: 600;
	}
	.quality-choices {
		display: grid;
		gap: 0.5rem;
	}
	.quality-choices label {
		display: flex;
		min-height: 3.5rem;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-canvas);
		padding: 0.6rem 0.75rem;
		font-weight: 400;
	}
	.quality-choices label.chosen {
		border-color: var(--action);
		background: color-mix(in oklab, var(--action) 10%, var(--surface-canvas));
	}
	.quality-choices input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--action);
	}
	/* Carries its own `data-theme`, so it renders in that theme's real colours
	   regardless of the page's currently active theme (see layout.css). */
	.theme-swatch {
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		border: var(--module-border);
		border-radius: var(--radius-sm);
		background: linear-gradient(135deg, var(--paper) 50%, var(--action) 50%);
		box-shadow: var(--shadow-panel);
	}
	.quality-choices strong,
	.quality-choices small {
		display: block;
	}
	.quality-choices small,
	.quality-note {
		color: var(--text-muted);
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.35;
	}
	.quality-note {
		margin-top: -0.5rem;
	}
	input[type='range'] {
		width: 100%;
		min-height: 3rem;
	}
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
	input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
</style>
