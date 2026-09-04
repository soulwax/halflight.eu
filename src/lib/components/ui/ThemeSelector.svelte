<script lang="ts">
	import {
		Box,
		Brush,
		Check,
		ChevronDown,
		Eye,
		Flame,
		Flower2,
		Gem,
		Hammer,
		Palette,
		Shapes,
		Sun,
		Zap
	} from '@lucide/svelte';
	import { themeManager, THEME_OPTIONS, VISUAL_STYLE_OPTIONS } from '#lib/theme/theme.svelte.js';
	import type { DarkTheme, VisualStyle } from '#lib/theme/types';

	const STYLE_ICONS = {
		'art-deco': Gem,
		'art-nouveau': Flower2,
		bauhaus: Shapes,
		'arts-and-crafts': Hammer,
		impressionism: Sun,
		cubism: Box,
		surrealism: Eye,
		expressionism: Flame,
		'pop-art': Zap,
		'abstract-expressionism': Brush
	} as const;

	let {
		compact = false,
		id = 'theme-selector'
	}: {
		compact?: boolean;
		id?: string;
	} = $props();

	let isOpen = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);

	const activeThemeOption = $derived(
		THEME_OPTIONS.find((t) => t.id === themeManager.current) ?? THEME_OPTIONS[0]
	);
	const activeStyleOption = $derived(
		VISUAL_STYLE_OPTIONS.find((style) => style.id === themeManager.currentStyle) ??
			VISUAL_STYLE_OPTIONS[0]
	);

	function toggleOpen() {
		isOpen = !isOpen;
	}

	function selectTheme(themeId: DarkTheme) {
		themeManager.setTheme(themeId);
		isOpen = false;
	}

	function selectVisualStyle(styleId: VisualStyle) {
		themeManager.setVisualStyle(styleId);
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (isOpen && menuRef && !menuRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="theme-selector-root" class:compact bind:this={menuRef}>
	<button
		type="button"
		{id}
		class="theme-trigger-btn"
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-label={`Current colour theme: ${activeThemeOption.name}; visual style: ${activeStyleOption.name}. Click to change appearance.`}
		onclick={toggleOpen}
	>
		<Palette size={compact ? 14 : 16} class="shrink-0 text-[var(--action)]" />

		<div class="theme-trigger-swatch shrink-0" aria-hidden="true">
			<span style="background: {activeThemeOption.swatch.bg};"></span>
			<span style="background: {activeThemeOption.swatch.surface};"></span>
			<span style="background: {activeThemeOption.swatch.accent};"></span>
		</div>

		<span class="theme-name truncate">{activeThemeOption.name} · {activeStyleOption.name}</span>

		<ChevronDown
			size={13}
			class={`shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
		/>
	</button>

	{#if isOpen}
		<div class="theme-dropdown-menu" role="listbox" aria-labelledby={id} tabindex="-1">
			<div class="theme-dropdown-header">
				<span class="text-[0.68rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
					Colour themes
				</span>
			</div>

			<div class="theme-options-list">
				{#each THEME_OPTIONS as option (option.id)}
					{@const isSelected = option.id === themeManager.current}
					<button
						type="button"
						role="option"
						aria-selected={isSelected}
						class="theme-option-item"
						class:selected={isSelected}
						onclick={() => selectTheme(option.id)}
					>
						<div class="theme-option-swatch" aria-hidden="true">
							<span style="background: {option.swatch.bg};"></span>
							<span style="background: {option.swatch.surface};"></span>
							<span style="background: {option.swatch.accent};"></span>
							<span style="background: {option.swatch.text};"></span>
						</div>

						<div class="theme-option-info">
							<strong class="theme-option-name">{option.name}</strong>
							{#if !compact}
								<span class="theme-option-desc">{option.description}</span>
							{/if}
						</div>

						{#if isSelected}
							<Check size={14} class="shrink-0 text-[var(--action)]" />
						{/if}
					</button>
				{/each}
			</div>

			<div class="theme-dropdown-header style-header">
				<span class="text-[0.68rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
					Visual styles
				</span>
			</div>

			<div class="theme-options-list visual-style-options-list">
				{#each VISUAL_STYLE_OPTIONS as option (option.id)}
					{@const isSelected = option.id === themeManager.currentStyle}
					{@const StyleIcon = STYLE_ICONS[option.id] ?? Shapes}
					<button
						type="button"
						role="option"
						aria-selected={isSelected}
						class="theme-option-item visual-style-option-item"
						class:selected={isSelected}
						onclick={() => selectVisualStyle(option.id)}
					>
						<StyleIcon size={15} class="shrink-0 text-[var(--action)]" />
						<div class="theme-option-info">
							<strong class="theme-option-name">{option.name}</strong>
							{#if !compact}
								<span class="theme-option-desc">{option.description}</span>
							{/if}
						</div>
						{#if isSelected}
							<Check size={14} class="shrink-0 text-[var(--action)]" />
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.theme-selector-root {
		position: relative;
		display: inline-block;
		width: 100%;
	}

	.theme-trigger-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-primary);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.12s ease;
		text-align: left;
	}

	.compact .theme-trigger-btn {
		padding: 0.4rem 0.6rem;
		font-size: 0.75rem;
	}

	.theme-trigger-btn:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.theme-trigger-swatch {
		display: flex;
		align-items: center;
		border-radius: 9999px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		width: 1.5rem;
		height: 0.75rem;
	}

	.theme-trigger-swatch span {
		flex: 1;
		height: 100%;
	}

	.theme-name {
		flex: 1;
		min-width: 0;
	}

	.theme-dropdown-menu {
		position: absolute;
		bottom: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		z-index: 50;
		min-width: 16rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-raised);
		overflow: hidden;
		animation: menu-slide-up 0.12s ease-out;
	}

	:global(.settings-theme-selector) .theme-dropdown-menu {
		bottom: auto;
		top: calc(100% + 0.35rem);
	}

	@keyframes menu-slide-up {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.theme-dropdown-header {
		padding: 0.5rem 0.75rem 0.35rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.theme-options-list {
		max-height: 14rem;
		overflow-y: auto;
		padding: 0.35rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		max-height: min(14rem, calc(100dvh - 8rem));
	}

	.theme-option-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.45rem 0.65rem;
		border-radius: var(--radius-sm);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-primary);
		cursor: pointer;
		text-align: left;
		transition: all 0.1s ease;
		width: 100%;
	}

	.theme-option-item:hover {
		background: var(--surface-selected);
		border-color: var(--border-subtle);
	}

	.theme-option-item.selected {
		background: var(--surface-selected);
		border-color: var(--action);
	}

	.style-header {
		border-top: 1px solid var(--border-subtle);
	}

	.visual-style-options-list {
		max-height: 14rem;
	}

	.visual-style-option-item {
		align-items: flex-start;
	}

	.theme-option-swatch {
		display: flex;
		align-items: center;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		width: 1.75rem;
		height: 1.1rem;
		flex-shrink: 0;
	}

	.theme-option-swatch span {
		flex: 1;
		height: 100%;
	}

	.theme-option-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}

	.theme-option-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.theme-option-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.25;
		display: -webkit-box;
		line-clamp: 1;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
