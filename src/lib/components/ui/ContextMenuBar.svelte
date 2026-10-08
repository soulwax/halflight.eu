<script lang="ts">
	import { tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { contextMenu } from '#lib/context-menu/context-menu.svelte';
	import { ACTION_SIZE, BAR_PADDING, layoutBar, placeBar } from '#lib/context-menu/placement';

	let bar = $state<HTMLDivElement | null>(null);
	let viewport = $state({ width: 1024, height: 768 });

	function measureViewport() {
		const visual = window.visualViewport;
		viewport = {
			width: visual?.width ?? window.innerWidth,
			height: visual?.height ?? window.innerHeight
		};
	}

	const layout = $derived(layoutBar(contextMenu.actions.length, viewport));
	const placement = $derived(placeBar(contextMenu.anchor, layout, viewport));

	function buttons(): HTMLButtonElement[] {
		return bar ? [...bar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')] : [];
	}

	$effect(() => {
		if (!contextMenu.open) return;
		measureViewport();
		void tick().then(() => buttons()[0]?.focus({ preventScroll: true }));

		const closeOutside = (event: PointerEvent) => {
			if (bar && event.target instanceof Node && bar.contains(event.target)) return;
			contextMenu.close();
		};
		const close = () => contextMenu.close();
		window.addEventListener('pointerdown', closeOutside, true);
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		window.addEventListener('blur', close);
		return () => {
			window.removeEventListener('pointerdown', closeOutside, true);
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('resize', close);
			window.removeEventListener('blur', close);
		};
	});

	afterNavigate(() => contextMenu.close());

	function onKeydown(event: KeyboardEvent) {
		const items = buttons();
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		const step: Record<string, number> = {
			ArrowRight: 1,
			ArrowLeft: -1,
			ArrowDown: layout.columns,
			ArrowUp: -layout.columns
		};
		if (event.key in step) {
			event.preventDefault();
			const next = (index + step[event.key] + items.length) % items.length;
			items[next]?.focus();
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			contextMenu.close(true);
		} else if (event.key === 'Tab') {
			contextMenu.close(true);
		}
	}

	async function run(action: (typeof contextMenu.actions)[number]) {
		contextMenu.close(true);
		await action.onSelect();
	}
</script>

{#if contextMenu.open}
	<div
		bind:this={bar}
		class="context-bar"
		class:flip-x={placement.flippedX}
		class:flip-y={placement.flippedY}
		role="menu"
		aria-orientation={layout.rows > 1 ? 'vertical' : 'horizontal'}
		tabindex="-1"
		style:left="{placement.left}px"
		style:top="{placement.top}px"
		style:--columns={layout.columns}
		style:--action-size="{ACTION_SIZE}px"
		style:--bar-padding="{BAR_PADDING}px"
		onkeydown={onKeydown}
		oncontextmenu={(event) => event.preventDefault()}
	>
		{#each contextMenu.actions as action (action.id)}
			{@const Icon = action.icon}
			<button
				type="button"
				role="menuitem"
				class="context-action"
				class:danger={action.tone === 'danger'}
				aria-label={action.label}
				title={action.label}
				disabled={action.disabled}
				onclick={() => run(action)}
			>
				<Icon size={16} aria-hidden="true" />
			</button>
		{/each}
	</div>
{/if}

{#if contextMenu.feedback}
	<p class="context-feedback" role="status">{contextMenu.feedback}</p>
{/if}

<style>
	.context-bar {
		position: fixed;
		z-index: 1000;
		display: grid;
		grid-template-columns: repeat(var(--columns), var(--action-size));
		gap: var(--bar-padding) 0;
		padding: var(--bar-padding);
		border: 1px solid var(--border-strong, var(--border-subtle));
		border-radius: 8px;
		background: var(--surface-raised);
		box-shadow:
			0 10px 30px rgb(0 0 0 / 0.28),
			0 2px 6px rgb(0 0 0 / 0.18);
		transform-origin: top left;
		animation: context-bar-in 110ms ease-out;
	}
	/* Grow out of the pivot the bar was reversed around. */
	.context-bar.flip-x {
		transform-origin: top right;
	}
	.context-bar.flip-y {
		transform-origin: bottom left;
	}
	.context-bar.flip-x.flip-y {
		transform-origin: bottom right;
	}
	.context-action {
		display: grid;
		place-items: center;
		width: var(--action-size);
		height: var(--action-size);
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
	}
	.context-action:hover,
	.context-action:focus-visible {
		background: color-mix(in srgb, var(--action) 18%, transparent);
		color: var(--action);
		outline: none;
	}
	.context-action:focus-visible {
		box-shadow: inset 0 0 0 2px var(--action);
	}
	.context-action.danger:hover,
	.context-action.danger:focus-visible {
		background: color-mix(in srgb, var(--danger) 18%, transparent);
		color: var(--danger);
	}
	.context-action:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.context-feedback {
		position: fixed;
		z-index: 1000;
		left: 50%;
		bottom: calc(24px + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		margin: 0;
		max-width: calc(100vw - 32px);
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		background: var(--surface-raised);
		color: var(--text-primary);
		font-size: 0.85rem;
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
		pointer-events: none;
	}
	@keyframes context-bar-in {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.context-bar {
			animation: none;
		}
	}
</style>
