<script lang="ts">
	import { resolve } from '$app/paths';
	import { CloudUpload, CloudOff, CloudAlert } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';

	let { mobile = false, compactText = false }: { mobile?: boolean; compactText?: boolean } =
		$props();
	let open = $state(false);
	const status = $derived(player.persistenceStatus);
	const delayed = $derived(status === 'offline' || status === 'server_error');
	const label = $derived(
		status === 'saved'
			? m.player_sync_saved()
			: status === 'buffered'
				? m.player_sync_buffered()
				: delayed
					? player.localQueueSaved
						? m.player_sync_local()
						: m.player_sync_delayed()
					: status === 'conflict'
						? m.player_sync_conflict()
						: status === 'rejected'
							? m.player_sync_rejected()
							: m.player_sync_unauthenticated()
	);
	$effect(() => {
		if (status === 'saved' || status === 'saving') open = false;
	});
</script>

{#if status !== 'saving' && status !== 'saved'}
	<div class="session-save-status delayed" class:mobile>
		<button
			type="button"
			class="save-indicator"
			class:with-text={compactText}
			onclick={() => (open = true)}
			aria-label={label}
			title={label}
			aria-haspopup="dialog"
		>
			{#if status === 'buffered'}<CloudUpload size={16} aria-hidden="true" />
			{:else if delayed}<CloudOff size={16} aria-hidden="true" />
			{:else}<CloudAlert size={16} aria-hidden="true" />{/if}
			{#if compactText}<span class="status-text">{label}</span>{/if}
		</button>
	</div>

	<Dialog bind:open title={m.player_sync_details()} description={label}>
		{#if status === 'conflict'}
			<Button onclick={() => void player.refreshQueueFromServer()}>{m.player_sync_refresh()}</Button
			>
		{:else if delayed || status === 'buffered'}
			<Button onclick={() => player.retryPersistence()}>{m.player_sync_retry()}</Button>
		{:else if status === 'unauthenticated'}
			<Button href={resolve('/sign-in')}>{m.sign_in_button()}</Button>
		{/if}
	</Dialog>
{/if}

<style>
	.session-save-status {
		display: inline-flex;
		flex: none;
		color: var(--text-muted);
	}
	.save-indicator {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: inherit;
	}
	.mobile .save-indicator {
		width: 2rem;
		height: 2rem;
	}
	.mobile .save-indicator.with-text {
		display: inline-flex;
		width: auto;
		min-height: 48px;
		height: auto;
		justify-content: flex-start;
		gap: 0.5rem;
		padding-inline: 0.25rem;
		text-align: left;
	}
	.status-text {
		font-size: var(--fs-xs);
		line-height: 1.35;
	}
	button {
		cursor: pointer;
	}
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.delayed {
		color: var(--action);
	}
</style>
