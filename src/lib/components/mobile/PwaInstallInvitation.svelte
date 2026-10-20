<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Download, X } from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { installPromptState } from '#lib/mobile/install-prompt.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const DISMISSED_KEY = 'syn:pwa-install-invitation-dismissed';
	let ready = $state(false);
	let dismissed = $state(false);
	let visible = $state(false);
	let prompting = $state(false);

	$effect(() => {
		if (ready && !dismissed && player.hasQualifiedListen) visible = true;
	});

	onMount(() => {
		try {
			dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
		} catch {
			// Storage may be disabled; keep dismissal for this mounted page only.
		}
		ready = true;
		const installed = () => dismiss();
		window.addEventListener('appinstalled', installed);
		return () => window.removeEventListener('appinstalled', installed);
	});

	function dismiss(): void {
		visible = false;
		dismissed = true;
		try {
			localStorage.setItem(DISMISSED_KEY, '1');
		} catch {
			// The invitation remains dismissed until this component is remounted.
		}
	}

	async function install(): Promise<void> {
		const prompt = installPromptState.event;
		if (!prompt || prompting) return;
		installPromptState.event = null;
		prompting = true;
		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;
			if (choice.outcome === 'dismissed') dismiss();
			else visible = false;
		} catch {
			// The one-shot event is consumed; Settings retains browser instructions.
			visible = false;
		} finally {
			prompting = false;
		}
	}
</script>

{#if visible}
	<aside class="install-invitation" aria-label={m.pwa_invitation_title()} aria-live="polite">
		<div class="copy">
			<strong>{m.pwa_invitation_title()}</strong>
			<p>{m.pwa_invitation_description()}</p>
		</div>
		<div class="actions">
			{#if installPromptState.event}
				<button type="button" disabled={prompting} onclick={install}>
					<Download size={16} aria-hidden="true" />{m.mobile_install_action()}
				</button>
			{:else}
				<a href={resolve('/(mobile)/settings')}>{m.pwa_invitation_settings()}</a>
			{/if}
			<button
				type="button"
				class="dismiss"
				aria-label={m.pwa_invitation_dismiss()}
				onclick={dismiss}><X size={18} aria-hidden="true" /></button
			>
		</div>
	</aside>
{/if}

<style>
	.install-invitation {
		position: fixed;
		z-index: 90;
		inset-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
		bottom: calc(6.25rem + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		max-width: 34rem;
		margin-inline: auto;
		padding: 0.75rem 0.875rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		box-shadow: 0 8px 28px rgb(0 0 0 / 20%);
	}
	.copy {
		min-width: 0;
	}
	.copy p {
		margin: 0.2rem 0 0;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.4rem;
	}
	button,
	.actions a {
		display: inline-flex;
		min-height: 2.5rem;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border: 0;
		border-radius: var(--radius-sm);
		padding: 0.45rem 0.65rem;
		background: var(--action);
		color: var(--action-contrast);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
	}
	button.dismiss {
		width: 2.5rem;
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-primary);
	}
	button:disabled {
		cursor: wait;
		opacity: 0.6;
	}
	button:focus-visible,
	.actions a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	@media (max-width: 420px) {
		.install-invitation {
			align-items: stretch;
			flex-direction: column;
			gap: 0.65rem;
		}
		.actions {
			justify-content: flex-end;
		}
	}
</style>
