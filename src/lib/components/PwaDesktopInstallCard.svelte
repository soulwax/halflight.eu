<script lang="ts">
	import { onMount } from 'svelte';
	import { CircleCheck, Download } from '@lucide/svelte';
	import { installPromptState } from '#lib/mobile/install-prompt.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let isInstalled = $state(false);
	let isPrompting = $state(false);
	let helpText = $state(m.desktop_pwa_help_other());

	onMount(() => {
		const displayMode = window.matchMedia('(display-mode: standalone)');
		const syncInstalled = () => {
			isInstalled =
				displayMode.matches ||
				(navigator as Navigator & { standalone?: boolean }).standalone === true;
		};
		const onInstalled = () => {
			isInstalled = true;
			installPromptState.event = null;
		};
		const userAgent = navigator.userAgent;
		if (/Safari/i.test(userAgent) && !/(Chrome|CriOS|Edg|OPR|Firefox)/i.test(userAgent)) {
			helpText = m.desktop_pwa_help_safari();
		} else if (/Chrome|Edg/i.test(userAgent)) {
			helpText = m.desktop_pwa_help_chromium();
		}

		syncInstalled();
		displayMode.addEventListener('change', syncInstalled);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			displayMode.removeEventListener('change', syncInstalled);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	async function install(): Promise<void> {
		const prompt = installPromptState.event;
		if (!prompt || isPrompting) return;

		installPromptState.event = null;
		isPrompting = true;
		try {
			await prompt.prompt();
			await prompt.userChoice;
		} catch {
			// The event is one-shot; the browser's installation menu remains available.
		} finally {
			isPrompting = false;
		}
	}
</script>

<section class="install-card" aria-labelledby="desktop-pwa-title">
	<div class="heading">
		<Download size={20} aria-hidden="true" />
		<div>
			<h2 id="desktop-pwa-title">{m.desktop_pwa_title()}</h2>
			<p>{m.desktop_pwa_description()}</p>
		</div>
	</div>

	{#if isInstalled}
		<p class="installed" role="status">
			<CircleCheck size={18} aria-hidden="true" />{m.desktop_pwa_installed()}
		</p>
	{:else if installPromptState.event}
		<button type="button" disabled={isPrompting} aria-busy={isPrompting} onclick={install}>
			{m.desktop_pwa_action()}
		</button>
	{:else}
		<details>
			<summary>{m.desktop_pwa_help_title()}</summary>
			<p>{helpText}</p>
		</details>
	{/if}
</section>

<style>
	.install-card {
		margin-top: 2rem;
		padding: 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
	}
	.heading {
		display: flex;
		align-items: flex-start;
		gap: 0.875rem;
	}
	h2,
	p {
		margin: 0;
	}
	.heading p,
	details p {
		margin-top: 0.35rem;
		color: var(--text-muted);
		line-height: 1.5;
	}
	.heading > :global(svg),
	.installed :global(svg) {
		flex: none;
		color: var(--action);
	}
	button {
		min-height: 2.75rem;
		margin-top: 1rem;
		border: 0;
		border-radius: var(--radius-sm);
		padding: 0.6rem 1rem;
		background: var(--action);
		color: var(--action-contrast);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.6;
	}
	.installed {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	details {
		margin-top: 1rem;
	}
	summary {
		width: fit-content;
		cursor: pointer;
		font-weight: 600;
	}
	summary:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
</style>
