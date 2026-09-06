<script lang="ts">
	import { RefreshCw, WifiOff } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	function retry() {
		window.location.reload();
	}
</script>

<svelte:head>
	<title>{m.offline_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.offline_description()} />
</svelte:head>

<main class="offline-page" aria-labelledby="offline-title">
	<section class="offline-card">
		<div class="offline-icon" aria-hidden="true"><WifiOff size={32} strokeWidth={1.5} /></div>
		<p class="offline-brand">{m.brand_name()}</p>
		<h1 id="offline-title">{m.offline_title()}</h1>
		<p>{m.offline_description()}</p>
		<button type="button" onclick={retry}>
			<RefreshCw size={18} aria-hidden="true" />
			{m.offline_retry()}
		</button>
	</section>
</main>

<style>
	.offline-page {
		display: grid;
		min-height: 100dvh;
		place-items: center;
		background: var(--surface-canvas);
		color: var(--text-primary);
		padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));
	}

	.offline-card {
		display: grid;
		max-width: 25rem;
		justify-items: center;
		gap: 1rem;
		text-align: center;
	}

	.offline-icon {
		display: grid;
		height: 4rem;
		width: 4rem;
		place-items: center;
		border: 1px solid var(--border-subtle);
		border-radius: 9999px;
		color: var(--action);
	}

	.offline-brand,
	h1,
	p {
		margin: 0;
	}

	.offline-brand {
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(2rem, 10vw, 2.7rem);
		font-weight: 400;
		line-height: 1.1;
	}

	p:not(.offline-brand) {
		color: var(--text-muted);
		line-height: 1.55;
	}

	button {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm);
		background: var(--action);
		color: var(--action-contrast);
		cursor: pointer;
		font: inherit;
		font-weight: 600;
		padding: 0.5rem 1rem;
	}

	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: no-preference) {
		button:hover :global(svg) {
			transform: rotate(180deg);
			transition: transform 180ms ease-out;
		}
	}
</style>
