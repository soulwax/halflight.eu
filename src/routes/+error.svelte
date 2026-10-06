<script lang="ts">
	import { AlertTriangle, ArrowLeft } from '@lucide/svelte';

	import { page } from '$app/state';
	import Button from '#lib/components/ui/Button.svelte';
	import { errorRecoveryPath } from '#lib/mobile/routes';
	import { m } from '#lib/paraglide/messages';
	import { localizeHref } from '#lib/paraglide/runtime';

	// A Halflight Now URL that fails outside its own layout still returns to the
	// mobile site; only desktop and unrelated paths go to the Listening Room.
	const recovery = $derived(errorRecoveryPath(page.url.pathname));
</script>

<svelte:head>
	<title>{m.error_title()} — {m.brand_name()}</title>
</svelte:head>

<main
	class="flex min-h-[60dvh] items-center justify-center px-6 py-16"
	aria-labelledby="error-title"
>
	<section
		class="max-w-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-8"
	>
		<div
			class="flex size-11 items-center justify-center border border-[var(--danger)] bg-[var(--danger-subtle)] text-[var(--danger)]"
			aria-hidden="true"
		>
			<AlertTriangle size={22} />
		</div>
		<h1 id="error-title" class="mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
			{m.error_title()}
		</h1>
		<p class="mt-3 text-sm leading-6 text-[var(--text-muted)]">
			{recovery === '/home' ? m.now_error_description() : m.error_description()}
		</p>
		<Button href={localizeHref(recovery)} variant="primary" size="md" class="mt-6 w-full sm:w-auto">
			<ArrowLeft size={16} class="mr-2" />
			{recovery === '/home' ? m.now_error_home() : m.error_return()}
		</Button>
	</section>
</main>
