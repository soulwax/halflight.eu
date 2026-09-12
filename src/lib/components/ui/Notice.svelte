<script lang="ts">
	import { AlertCircle, AlertTriangle, CheckCircle2, Info } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * A short, inline message about what just happened: a connection succeeded, a
	 * save failed, a query was rejected.
	 *
	 * Seven routes had written their own version of this — `.notice`, `.state-error`,
	 * `.generator-notice`, `.form-error`, `.api-console-error`, plus two Tailwind
	 * clones — and two of them distinguished success from failure by text colour
	 * alone, which is not a distinction for anyone who cannot see the difference.
	 * The tone here always carries an icon as well as a colour, and picks the right
	 * live-region role so call sites stop having to remember it: a failure
	 * interrupts (`alert`), anything else waits its turn (`status`) — including a
	 * warning, which in this app always describes a standing precondition shown on
	 * load rather than a response to something the listener just did.
	 */
	let {
		tone = 'info',
		children
	}: {
		tone?: 'info' | 'success' | 'warning' | 'danger';
		children: Snippet;
	} = $props();

	const TONE_ICON = {
		info: Info,
		success: CheckCircle2,
		warning: AlertTriangle,
		danger: AlertCircle
	};
	const ToneIcon = $derived(TONE_ICON[tone]);
</script>

<div class="notice" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
	<ToneIcon size={18} aria-hidden="true" />
	<div class="notice-body">{@render children()}</div>
</div>

<style>
	.notice {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		padding: 0.85rem 1rem;
		border: var(--module-border);
		border-radius: var(--module-radius);
		background: var(--module-bg);
		color: var(--text-secondary);
		font-size: var(--fs-base);
		line-height: 1.5;
	}

	.notice :global(svg) {
		flex: none;
		margin-top: 0.1rem;
		color: var(--text-muted);
	}

	.notice-body {
		min-width: 0;
	}

	.notice-body :global(> :first-child) {
		margin-top: 0;
	}

	.notice-body :global(> :last-child) {
		margin-bottom: 0;
	}

	.notice[data-tone='success'] {
		border-color: color-mix(in oklab, var(--success) 38%, var(--border-subtle));
		background: var(--success-subtle);
		color: var(--text-primary);
	}

	.notice[data-tone='success'] :global(svg) {
		color: var(--success);
	}

	.notice[data-tone='warning'] {
		border-color: color-mix(in oklab, var(--warning) 38%, var(--border-subtle));
		background: var(--warning-subtle);
		color: var(--text-primary);
	}

	.notice[data-tone='warning'] :global(svg) {
		color: var(--warning);
	}

	.notice[data-tone='danger'] {
		border-color: color-mix(in oklab, var(--danger) 38%, var(--border-subtle));
		background: var(--danger-subtle);
		color: var(--text-primary);
	}

	.notice[data-tone='danger'] :global(svg) {
		color: var(--danger);
	}
</style>
