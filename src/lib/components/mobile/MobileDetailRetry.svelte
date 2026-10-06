<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';

	let refreshing = $state(false);
	let failed = $state(false);

	async function retry(): Promise<void> {
		if (refreshing) return;
		refreshing = true;
		failed = false;
		try {
			await invalidateAll();
		} catch {
			failed = true;
		} finally {
			refreshing = false;
		}
	}
</script>

<button type="button" disabled={refreshing} aria-busy={refreshing} onclick={retry}>
	{m.track_retry()}
</button>
{#if failed}<p role="status">{m.now_detail_retry_failed()}</p>{/if}

<style>
	button {
		display: inline-flex;
		min-height: 3rem;
		align-items: center;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--action);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
	p {
		margin-top: 1rem;
	}
</style>
