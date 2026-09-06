<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, description, actions, children }: Props = $props();
</script>

<section class="app-aside-section" aria-label={title}>
	<header class="app-aside-header">
		<div class="min-w-0">
			<h2 class="app-aside-title">{title}</h2>
			{#if description}<p class="app-aside-description">{description}</p>{/if}
		</div>
		{#if actions}<div class="app-aside-actions">{@render actions()}</div>{/if}
	</header>

	<div class="app-aside-body">{@render children()}</div>
</section>

<style>
	.app-aside-section {
		display: flex;
		min-height: 100%;
		flex-direction: column;
	}
	.app-aside-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: var(--hairline);
		padding: 1rem var(--shell-gutter);
	}
	.app-aside-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.app-aside-description {
		margin: 0.3rem 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.app-aside-actions {
		flex: 0 0 auto;
	}
	.app-aside-body {
		min-height: 0;
		padding: 0.75rem;
	}
</style>
