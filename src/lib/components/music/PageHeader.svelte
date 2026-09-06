<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Disc, ListMusic, Music, User } from '@lucide/svelte';

	let {
		imageUrl,
		title,
		eyebrow = 'HALFLIGHT // SPECIFICATION',
		type = 'album',
		children,
		actions
	}: {
		imageUrl?: string | null;
		title: string;
		eyebrow?: string;
		type?: 'album' | 'track' | 'artist' | 'playlist';
		children?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<header class="entity-page-header">
	{#if imageUrl}
		<img
			class="entity-cover"
			class:entity-cover-round={type === 'artist'}
			src={imageUrl}
			alt={`Cover for ${title}`}
		/>
	{:else}
		<div
			class="entity-cover entity-cover-placeholder"
			class:entity-cover-round={type === 'artist'}
			aria-hidden="true"
		>
			{#if type === 'artist'}
				<User size={48} />
			{:else if type === 'playlist'}
				<ListMusic size={48} />
			{:else if type === 'track'}
				<Music size={48} />
			{:else}
				<Disc size={48} />
			{/if}
		</div>
	{/if}

	<div class="entity-heading-area">
		{#if eyebrow}
			<p class="eyebrow">{eyebrow}</p>
		{/if}
		<h1 class="entity-title">{title}</h1>

		{#if children}
			<div class="entity-meta-wrap">
				{@render children()}
			</div>
		{/if}

		{#if actions}
			<div class="entity-header-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>

<style>
	.entity-page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: clamp(1.25rem, 3.5vw, 2.5rem);
		padding: clamp(1.25rem, 3.5vw, 2.5rem);
		border: 1px solid var(--border-subtle);
		background: linear-gradient(
			120deg,
			color-mix(in oklab, var(--editorial-sky, var(--surface-selected)) 54%, var(--surface-raised)),
			color-mix(in oklab, var(--editorial-blush, var(--surface-raised)) 34%, var(--surface-raised))
		);
		border-radius: var(--radius-xl);
		box-shadow: 0 18px 34px -28px rgb(6 48 100 / 35%);
		margin-bottom: 2rem;
	}

	.entity-cover {
		width: clamp(8rem, 16vw, 13rem);
		aspect-ratio: 1;
		object-fit: cover;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: 0 14px 26px -18px rgb(6 48 100 / 42%);
		flex-shrink: 0;
	}

	.entity-cover-round {
		border-radius: var(--radius-full);
	}

	.entity-cover-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.entity-heading-area {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		flex: 1 1 18rem;
	}

	.entity-title {
		margin: 0;
		font-size: clamp(1.5rem, 4vw, 2.4rem);
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.15;
		word-break: break-word;
	}

	.entity-meta-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-top: 0.25rem;
	}

	.entity-header-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}
</style>
