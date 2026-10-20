<script lang="ts">
	import { onMount } from 'svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	let waitingWorker = $state<ServiceWorker | null>(null);
	let applying = $state(false);
	let blockedByOtherWindow = $state(false);
	let reloadAfterControl = false;

	const canApply = $derived(
		!player.isPlaying &&
			!player.isLoading &&
			!player.isBuffering &&
			player.persistenceStatus === 'saved' &&
			!player.playbackClaimPending
	);

	onMount(() => {
		if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
		let disposed = false;

		const observe = (registration: ServiceWorkerRegistration) => {
			waitingWorker = registration.waiting;
			registration.addEventListener('updatefound', () => {
				const installing = registration.installing;
				if (!installing) return;
				installing.addEventListener('statechange', () => {
					if (!disposed && installing.state === 'installed' && registration.waiting) {
						waitingWorker = registration.waiting;
					}
				});
			});
		};

		void navigator.serviceWorker.ready.then((registration) => {
			if (!disposed) {
				observe(registration);
				void registration.update().catch(() => {});
			}
		});
		const onControllerChange = () => {
			if (reloadAfterControl) window.location.reload();
		};
		const onWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type === 'PWA_PREPARE_UPDATE' && event.ports[0]) {
				const safe = canApply;
				if (safe) reloadAfterControl = true;
				event.ports[0].postMessage({ safe });
				return;
			}
			if (
				event.data?.type === 'PWA_UPDATE_CANCELLED' ||
				event.data?.type === 'PWA_UPDATE_DEFERRED'
			) {
				reloadAfterControl = false;
				applying = false;
				blockedByOtherWindow = true;
			}
		};
		navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
		navigator.serviceWorker.addEventListener('message', onWorkerMessage);
		return () => {
			disposed = true;
			navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
			navigator.serviceWorker.removeEventListener('message', onWorkerMessage);
		};
	});

	async function applyUpdate(): Promise<void> {
		if (!waitingWorker || !canApply || applying) return;
		blockedByOtherWindow = false;
		applying = true;
		reloadAfterControl = false;
		player.flushPersistence();
		const deadline = Date.now() + 10_000;
		while (player.persistenceStatus === 'saving' && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		if (player.persistenceStatus !== 'saved' || player.isPlaying || player.isLoading) {
			applying = false;
			return;
		}
		waitingWorker.postMessage({ type: 'SKIP_WAITING' });
	}
</script>

{#if waitingWorker}
	<aside class="update-notice" aria-live="polite" aria-label={m.pwa_update_title()}>
		<div class="copy">
			<strong>{m.pwa_update_title()}</strong>
			<p>
				{blockedByOtherWindow
					? m.pwa_update_other_window()
					: canApply
						? m.pwa_update_ready()
						: m.pwa_update_wait()}
			</p>
		</div>
		<div class="actions">
			<button type="button" disabled={!canApply || applying} onclick={applyUpdate}>
				{m.pwa_update_action()}
			</button>
			<button type="button" class="later" onclick={() => (waitingWorker = null)}>
				{m.pwa_update_later()}
			</button>
		</div>
	</aside>
{/if}

<style>
	.update-notice {
		position: fixed;
		z-index: 100;
		inset-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
		bottom: calc(5.25rem + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		max-width: 42rem;
		margin-inline: auto;
		padding: 0.875rem 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		box-shadow: 0 8px 28px rgb(0 0 0 / 24%);
	}
	.copy {
		min-width: 0;
	}
	.copy p {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}
	.actions {
		display: flex;
		flex: none;
		gap: 0.5rem;
	}
	button {
		min-height: 2.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		padding: 0.5rem 0.75rem;
		background: var(--action);
		color: var(--action-contrast);
		font: inherit;
		font-weight: 600;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	button.later {
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-primary);
	}
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	@media (max-width: 420px) {
		.update-notice {
			align-items: stretch;
			flex-direction: column;
		}
		.actions {
			justify-content: flex-end;
		}
	}
</style>
