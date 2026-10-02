<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import Button from '#lib/components/ui/Button.svelte';
</script>

{#if player.persistenceStatus !== 'saved'}
	<div class="session-save-status" role="status">
		{#if player.persistenceStatus === 'saving'}
			<p>{m.player_sync_saving()}</p>
		{:else if player.persistenceStatus === 'conflict'}
			<p>{m.player_sync_conflict()}</p>
			<Button onclick={() => void player.refreshQueueFromServer()}>{m.player_sync_refresh()}</Button
			>
		{:else if player.persistenceStatus === 'offline'}
			<p>{m.player_sync_offline()}</p>
		{:else if player.persistenceStatus === 'server_error'}
			<p>{m.player_sync_server_error()}</p>
			<Button onclick={() => player.retryPersistence()}>{m.player_sync_retry()}</Button>
		{:else if player.persistenceStatus === 'rejected'}
			<p>{m.player_sync_rejected()}</p>
		{:else if player.persistenceStatus === 'unauthenticated'}
			<p>{m.player_sync_unauthenticated()}</p>
			<Button href={resolve('/sign-in')}>{m.sign_in_button()}</Button>
		{/if}
	</div>
{/if}

<style>
	.session-save-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0;
		font-size: var(--fs-sm);
		color: var(--text-secondary);
	}
	p {
		flex: 1 1 12rem;
		margin: 0;
	}
	.session-save-status :global(.btn-base) {
		min-height: 48px;
	}
</style>
