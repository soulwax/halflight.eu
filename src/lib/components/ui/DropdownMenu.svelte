<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { DropdownMenu as BitsMenu } from 'bits-ui';

	export interface DropdownMenuItem {
		id: string;
		label: string;
		icon?: Component<{ size?: number; class?: string }>;
		onSelect: () => void;
		disabled?: boolean;
		danger?: boolean;
		separator?: boolean;
	}

	let {
		open = $bindable(false),
		onOpenChange,
		items = [],
		trigger,
		triggerClass = '',
		triggerAriaLabel,
		children,
		align = 'end',
		side = 'bottom',
		sideOffset = 4,
		alignOffset = 0,
		class: className = '',
		contentClass = ''
	}: {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		items?: DropdownMenuItem[];
		trigger?: Snippet;
		triggerClass?: string;
		triggerAriaLabel?: string;
		children?: Snippet;
		align?: 'start' | 'center' | 'end';
		side?: 'top' | 'right' | 'bottom' | 'left';
		sideOffset?: number;
		alignOffset?: number;
		class?: string;
		contentClass?: string;
	} = $props();
</script>

<BitsMenu.Root bind:open {onOpenChange}>
	{#if trigger}
		<BitsMenu.Trigger class="dropdown-trigger-btn {triggerClass}" aria-label={triggerAriaLabel}>
			{@render trigger()}
		</BitsMenu.Trigger>
	{/if}

	<BitsMenu.Portal>
		<BitsMenu.Content
			class="dropdown-content {contentClass}"
			{align}
			{side}
			{sideOffset}
			{alignOffset}
		>
			{#if children}
				{@render children()}
			{:else}
				{#each items as item (item.id)}
					{#if item.separator}
						<BitsMenu.Separator class="dropdown-separator" />
					{/if}
					<BitsMenu.Item
						class="dropdown-item {item.danger ? 'dropdown-item-danger' : ''} {className}"
						disabled={item.disabled}
						onSelect={() => item.onSelect()}
					>
						{#if item.icon}
							{@const Icon = item.icon}
							<Icon size={15} class="dropdown-icon" />
						{/if}
						<span class="dropdown-label">{item.label}</span>
					</BitsMenu.Item>
				{/each}
			{/if}
		</BitsMenu.Content>
	</BitsMenu.Portal>
</BitsMenu.Root>

<style>
	:global(.dropdown-trigger-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--dur-fast) ease;
	}

	:global(.dropdown-trigger-btn:hover),
	:global(.dropdown-trigger-btn[data-state='open']) {
		border-color: var(--border-strong);
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	:global(.dropdown-trigger-btn:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	:global(.dropdown-content) {
		display: flex;
		flex-direction: column;
		min-width: 11.5rem;
		padding: 0.35rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-float);
		z-index: 170;
		outline: none;
		animation: dropdownFadeIn 0.12s ease;
	}

	:global(.dropdown-item) {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.65rem;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
		cursor: pointer;
		user-select: none;
		outline: none;
		transition: background-color var(--dur-fast) ease;
	}

	:global(.dropdown-item[data-highlighted]),
	:global(.dropdown-item:hover) {
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	:global(.dropdown-item[data-disabled]) {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}

	:global(.dropdown-item-danger) {
		color: var(--danger);
	}

	:global(.dropdown-item-danger[data-highlighted]),
	:global(.dropdown-item-danger:hover) {
		background: var(--danger-subtle);
		color: var(--danger);
	}

	:global(.dropdown-separator) {
		height: 1px;
		margin: 0.3rem 0;
		background: var(--border-subtle);
	}

	:global(.dropdown-icon) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	:global(.dropdown-item[data-highlighted] .dropdown-icon),
	:global(.dropdown-item:hover .dropdown-icon) {
		color: currentColor;
	}

	.dropdown-label {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@keyframes dropdownFadeIn {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
