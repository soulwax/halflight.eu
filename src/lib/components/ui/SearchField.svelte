<script lang="ts">
	import { LoaderCircle, Search, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		id,
		label,
		placeholder,
		value,
		searching = false,
		oninput,
		onclear,
		onkeydown,
		onfocus,
		oncompositionstart,
		input = $bindable<HTMLInputElement>(),
		composing = $bindable(false),
		combobox = false,
		expanded = false,
		controls,
		activeDescendant,
		shortcut = false
	}: {
		id: string;
		label: string;
		placeholder: string;
		value: string;
		searching?: boolean;
		oninput: (event: Event) => void;
		onclear: () => void;
		onkeydown?: (event: KeyboardEvent) => void;
		onfocus?: () => void;
		oncompositionstart?: () => void;
		input?: HTMLInputElement;
		composing?: boolean;
		combobox?: boolean;
		expanded?: boolean;
		controls?: string;
		activeDescendant?: string;
		shortcut?: boolean;
	} = $props();
	let committedComposition: string | null = null;

	function handleInput(event: Event): void {
		if (composing || (event as InputEvent).isComposing) return;
		const next = (event.currentTarget as HTMLInputElement).value;
		if (committedComposition === next) {
			committedComposition = null;
			return;
		}
		committedComposition = null;
		oninput(event);
	}

	function clear(): void {
		committedComposition = null;
		onclear();
		input?.focus();
	}

	function focusShortcut(event: KeyboardEvent): void {
		if (!shortcut || event.defaultPrevented || event.repeat || event.isComposing) return;
		if (document.querySelector('[role="dialog"]') && !input?.closest('[role="dialog"]')) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			input?.focus();
			input?.select();
		}
	}
</script>

<svelte:window onkeydown={focusShortcut} />
<div class="search-field">
	<label class="sr-only" for={id}>{label}</label>
	<Search size={18} aria-hidden="true" />
	<input
		bind:this={input}
		{id}
		name="q"
		type={combobox ? 'text' : 'search'}
		role={combobox ? 'combobox' : undefined}
		{value}
		{placeholder}
		maxlength="160"
		autocomplete="off"
		autocapitalize="none"
		autocorrect="off"
		spellcheck={false}
		enterkeyhint="search"
		oninput={handleInput}
		{onfocus}
		onkeydown={(event) => {
			if (!event.isComposing && !composing) onkeydown?.(event);
		}}
		oncompositionstart={() => {
			composing = true;
			committedComposition = null;
			oncompositionstart?.();
		}}
		oncompositionend={(event) => {
			composing = false;
			committedComposition = (event.currentTarget as HTMLInputElement).value;
			oninput(event);
		}}
		aria-autocomplete={combobox ? 'list' : undefined}
		aria-expanded={combobox ? expanded : undefined}
		aria-controls={controls}
		aria-activedescendant={expanded ? activeDescendant : undefined}
	/>
	{#if searching}<LoaderCircle
			class="animate-spin"
			size={18}
			aria-label={m.search_live_searching()}
		/>{/if}
	{#if value}
		<button type="button" class="clear" aria-label={m.search_clear()} onclick={clear}
			><X size={18} aria-hidden="true" /></button
		>
	{/if}
	<button
		type="submit"
		class="submit"
		aria-label={m.search_button()}
		title={shortcut ? m.search_shortcut() : m.search_button()}
		disabled={!value.trim() || composing}
	>
		<Search size={18} aria-hidden="true" />
	</button>
</div>

<style>
	.search-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		min-height: 3rem;
		padding-left: 0.9rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		color: var(--text-muted);
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}
	.search-field:focus-within {
		border-color: var(--action);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--action) 18%, transparent);
	}
	.search-field > :global(svg) {
		flex-shrink: 0;
	}
	input {
		width: 100%;
		min-width: 0;
		flex: 1;
		padding: 0.7rem 0;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		font-size: 1rem;
		outline: none;
	}
	input::placeholder {
		color: var(--text-muted);
		opacity: 1;
	}
	input::-webkit-search-cancel-button,
	input::-webkit-search-decoration {
		-webkit-appearance: none;
	}
	button {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 3rem;
		min-height: 3rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.submit {
		color: var(--action);
		border-left: 1px solid var(--border-subtle);
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -3px;
	}
	@media (hover: hover) {
		button:hover:not(:disabled) {
			background: var(--surface-selected);
			color: var(--action);
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		.search-field {
			transition: none;
		}
	}
</style>
