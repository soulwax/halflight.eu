<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog as BitsDialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		open = $bindable(false),
		onOpenChange,
		title,
		titleSnippet,
		description,
		descriptionSnippet,
		children,
		trigger,
		class: className = '',
		contentClass = '',
		showClose = true,
		closeDisabled = false
	}: {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		title?: string;
		titleSnippet?: Snippet;
		description?: string;
		descriptionSnippet?: Snippet;
		children?: Snippet;
		trigger?: Snippet;
		class?: string;
		contentClass?: string;
		showClose?: boolean;
		closeDisabled?: boolean;
	} = $props();
	let returnFocus: HTMLElement | null = null;
	$effect(() => {
		if (
			open &&
			document.activeElement instanceof HTMLElement &&
			document.activeElement !== document.body &&
			!document.activeElement.closest('[role="dialog"]')
		)
			returnFocus = document.activeElement;
	});
	function restoreFocus(event: Event) {
		if (returnFocus?.isConnected) {
			event.preventDefault();
			returnFocus.focus();
		}
	}
</script>

<BitsDialog.Root bind:open {onOpenChange}>
	{#if trigger}
		<BitsDialog.Trigger>
			{#snippet child({ props })}
				<div {...props}>
					{@render trigger()}
				</div>
			{/snippet}
		</BitsDialog.Trigger>
	{/if}
	<BitsDialog.Portal>
		<BitsDialog.Overlay class="dialog-overlay" />
		<BitsDialog.Content
			class="dialog-content {contentClass}"
			onCloseAutoFocus={restoreFocus}
			onEscapeKeydown={(event) => {
				if (closeDisabled) event.preventDefault();
			}}
			onInteractOutside={(event) => {
				if (closeDisabled) event.preventDefault();
			}}
		>
			<header class="dialog-header">
				<div class="dialog-header-text">
					{#if titleSnippet}
						{@render titleSnippet()}
					{:else if title}
						<BitsDialog.Title class="dialog-title">{title}</BitsDialog.Title>
					{/if}
					{#if descriptionSnippet}
						{@render descriptionSnippet()}
					{:else if description}
						<BitsDialog.Description class="dialog-description">{description}</BitsDialog.Description
						>
					{/if}
				</div>
				{#if showClose}
					<BitsDialog.Close
						disabled={closeDisabled}
						class="dialog-close-btn"
						aria-label={m.action_close()}
					>
						<X size={18} />
					</BitsDialog.Close>
				{/if}
			</header>
			<div class="dialog-body {className}">
				{#if children}{@render children()}{/if}
			</div>
		</BitsDialog.Content>
	</BitsDialog.Portal>
</BitsDialog.Root>

<style>
	:global(.dialog-overlay) {
		position: fixed;
		inset: 0;
		background: var(--overlay);
		z-index: 150;
		animation: dialogFadeIn 0.15s ease;
	}

	:global(.dialog-content) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: calc(100% - 2rem);
		max-width: 32rem;
		max-height: calc(100dvh - 3rem);
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-xl, 16px);
		box-shadow:
			0 24px 56px -8px rgb(0 0 0 / 72%),
			4px 4px 0px var(--border-strong);
		z-index: 160;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		outline: none;
		animation: dialogScaleUp 0.15s ease;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.15rem 1.4rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		flex-shrink: 0;
	}

	.dialog-header-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	:global(.dialog-title) {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--text-primary);
	}

	:global(.dialog-description) {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.35;
	}

	:global(.dialog-close-btn) {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--dur-fast) ease;
	}

	:global(.dialog-close-btn:hover) {
		border-color: var(--border-strong);
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	:global(.dialog-close-btn:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.dialog-body {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		flex: 1;
	}

	@keyframes dialogFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes dialogScaleUp {
		from {
			opacity: 0;
			transform: translate(-50%, -48%) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.dialog-overlay),
		:global(.dialog-content) {
			animation: none;
		}
	}
</style>
