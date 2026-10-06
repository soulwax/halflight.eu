<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { AlertTriangle, RotateCw } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime';

	// Rendered inside the Halflight Now layout, so the mini player, tabs and audio
	// survive a failed screen. Without this file an error fell through to the root
	// error page, whose only way out led to the desktop Listening Room.
	let retrying = $state(false);

	async function retry() {
		retrying = true;
		try {
			await goto(page.url.href, { invalidateAll: true, replaceState: true, noScroll: true });
		} finally {
			retrying = false;
		}
	}
</script>

<svelte:head>
	<title>{m.error_title()} — {m.brand_name()}</title>
</svelte:head>

<section class="mobile-error" aria-labelledby="mobile-error-title">
	<div class="icon" aria-hidden="true"><AlertTriangle size={22} /></div>
	<h1 id="mobile-error-title" tabindex="-1">{m.error_title()}</h1>
	<p>{page.status === 404 ? m.now_error_not_found() : m.now_error_description()}</p>
	<div class="actions">
		<a class="primary" href={localizeHref(resolve('/(mobile)/home'))}>{m.now_error_home()}</a>
		{#if page.status !== 404}
			<button type="button" onclick={retry} disabled={retrying} aria-busy={retrying}>
				<RotateCw size={16} aria-hidden="true" class={retrying ? 'animate-spin' : ''} />
				{m.track_retry()}
			</button>
		{/if}
	</div>
</section>

<style>
	.mobile-error {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		max-width: 26rem;
		margin: 0 auto;
		padding: 3.5rem 1.5rem 2rem;
		text-align: center;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-full);
		background: var(--danger-subtle);
		color: var(--danger);
	}

	h1 {
		margin: 0.4rem 0 0;
		font-size: var(--fs-xl);
		line-height: 1.15;
	}

	h1:focus {
		outline: none;
	}

	p {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-base);
		line-height: 1.5;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
		margin-top: 0.75rem;
	}

	.actions > * {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		min-height: 3rem;
		padding: 0 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		touch-action: manipulation;
	}

	.actions .primary {
		border-color: transparent;
		background: var(--action);
		color: var(--action-contrast, var(--surface-canvas));
	}

	.actions > *:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.actions button:disabled {
		opacity: 0.6;
	}
</style>
