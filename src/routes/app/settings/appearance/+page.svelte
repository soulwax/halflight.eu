<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import type { Theme } from '#lib/server/theme-settings';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Deliberately captured once, not kept in sync with `data`/`form`: the
	// radio group is the user's own in-progress pick until they submit it.
	let selected = $state<Theme>(untrack(() => form?.theme ?? data.theme));
	let saving = $state(false);

	const THEME_LABELS: Record<Theme, { name: () => string; description: () => string }> = {
		dark: { name: m.theme_dark_name, description: m.theme_dark_description },
		light: { name: m.theme_light_name, description: m.theme_light_description },
		'warm-night': { name: m.theme_warm_night_name, description: m.theme_warm_night_description },
		electric: { name: m.theme_electric_name, description: m.theme_electric_description }
	};

	// Reflects the pick immediately on this page's own chrome — the shared
	// root layout only re-applies `data-theme` to <html> once the form action
	// round-trips, which this anticipates rather than replaces.
	function preview(theme: Theme): void {
		selected = theme;
		document.documentElement.dataset.theme = theme;
	}
</script>

<svelte:head>
	<title>{m.appearance_settings_title()} — {m.brand_name()}</title>
</svelte:head>

<section class="appearance-settings" aria-labelledby="appearance-title">
	<ViewHeader
		eyebrow={m.view_eyebrow_appearance()}
		title={m.appearance_settings_title()}
		titleId="appearance-title"
		description={m.appearance_settings_description()}
	/>

	{#if form?.themeSaved}
		<Notice tone="success">{m.appearance_saved_notice()}</Notice>
	{:else if form?.themeError}
		<Notice tone="danger">{m.appearance_error_notice()}</Notice>
	{/if}

	<form
		method="POST"
		action="?/saveTheme"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				saving = false;
				await update();
			};
		}}
	>
		<fieldset class="theme-fieldset">
			<legend class="theme-legend">{m.appearance_theme_legend()}</legend>
			<div class="theme-grid">
				{#each data.themes as theme (theme)}
					{@const label = THEME_LABELS[theme]}
					<label class="theme-option" class:theme-option-selected={selected === theme}>
						<input
							type="radio"
							name="theme"
							value={theme}
							checked={selected === theme}
							onchange={() => preview(theme)}
							class="sr-only"
						/>
						<span
							class="theme-swatch"
							data-theme={theme}
							role="img"
							aria-label={m.theme_preview_label({ theme: label.name() })}
						>
							<span class="theme-swatch-surface">
								<span class="theme-swatch-accent"></span>
							</span>
						</span>
						<span class="theme-option-copy">
							<span class="theme-option-name">
								{label.name()}
								{#if selected === theme}
									<Check size={14} aria-hidden="true" />
								{/if}
							</span>
							<span class="theme-option-description">{label.description()}</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="theme-actions">
			<Button type="submit" variant="primary" disabled={saving}>
				{m.appearance_save()}
			</Button>
		</div>
	</form>
</section>

<style>
	.appearance-settings {
		max-width: 44rem;
	}

	.theme-fieldset {
		margin: 1.5rem 0 0;
		padding: 0;
		border: 0;
	}

	.theme-legend {
		padding: 0;
		margin: 0 0 0.75rem;
		font-size: var(--fs-sm);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.9rem;
	}

	.theme-option {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.9rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		cursor: pointer;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.theme-option:hover {
		border-color: var(--border-strong);
	}

	.theme-option:has(input:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.theme-option-selected {
		border-color: var(--action);
		box-shadow: 0 0 0 1px var(--action);
	}

	/* Each swatch carries its own `data-theme`, so it renders in that theme's
	   real colours regardless of the page's currently active theme — see the
	   broadened `[data-theme]` selectors in layout.css. */
	.theme-swatch {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		height: 3.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--paper);
	}

	.theme-swatch-surface {
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0.3rem;
		border-radius: calc(var(--radius-sm) - 2px);
		background: var(--surface);
	}

	.theme-swatch-accent {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: var(--radius-full);
		background: var(--action);
	}

	.theme-option-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.theme-option-name {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.theme-option-name :global(svg) {
		color: var(--action);
	}

	.theme-option-description {
		font-size: var(--fs-xs);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.theme-actions {
		margin-top: 1.5rem;
	}
</style>
