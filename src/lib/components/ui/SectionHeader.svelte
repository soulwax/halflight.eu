<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		titleId,
		subtitle,
		count,
		children,
		actions
	}: {
		eyebrow?: string;
		title: string;
		titleId?: string;
		subtitle?: string;
		count?: number | string;
		children?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="section-header-wrap">
	<div class="section-header-title-area">
		{#if eyebrow}
			<p class="eyebrow">{eyebrow}</p>
		{/if}
		<div class="flex items-center gap-2.5">
			{#if children}
				{@render children()}
			{/if}
			<h2 id={titleId} class="section-heading-text">{title}</h2>
			{#if count !== undefined}
				<span class="font-mono text-xs text-[var(--text-muted)]">({count})</span>
			{/if}
		</div>
		{#if subtitle}
			<p class="section-subtitle-text">{subtitle}</p>
		{/if}
	</div>

	{#if actions}
		<div class="section-header-actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.section-header-wrap {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.section-header-title-area {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.section-heading-text {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.section-subtitle-text {
		margin: 0;
		font-size: 0.82rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.section-header-actions {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
</style>
