<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Notice from '#lib/components/ui/Notice.svelte';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let mode = $state<'signIn' | 'signUp'>('signIn');
</script>

<svelte:head>
	<title>{m.sign_in_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.sign_in_subtitle()} />
</svelte:head>

<main class="auth-page">
	<section class="auth-card" aria-labelledby="sign-in-title">
		<img class="brand-logo" src="/icons/halflight-128.png" alt={m.brand_name()} />
		<h1 id="sign-in-title">{m.sign_in_title()}</h1>
		<p class="intro">{m.sign_in_subtitle()}</p>

		{#if form?.signInFailed || form?.signUpFailed}
			<Notice tone="danger">{m.sign_in_error()}</Notice>
		{/if}
		{#if form?.verificationSent}
			<Notice tone="success">{m.sign_up_verification_sent()}</Notice>
		{/if}

		<form method="post" action="?/signInSocial">
			<button class="github-button" type="submit">
				<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
					<path
						fill="currentColor"
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
						0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
						-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
						.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
						-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
						1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
						1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
						1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
					/>
				</svg>
				{m.sign_in_github()}
			</button>
		</form>

		<div class="divider" role="separator" aria-orientation="horizontal">
			<span>{m.sign_in_divider()}</span>
		</div>

		<div class="mode-tabs" role="group" aria-label={m.sign_in_mode_group_label()}>
			<button
				type="button"
				aria-pressed={mode === 'signIn'}
				class:active={mode === 'signIn'}
				onclick={() => (mode = 'signIn')}
			>
				{m.sign_in_button()}
			</button>
			<button
				type="button"
				aria-pressed={mode === 'signUp'}
				class:active={mode === 'signUp'}
				onclick={() => (mode = 'signUp')}
			>
				{m.sign_up_button()}
			</button>
		</div>

		<form
			method="post"
			action={mode === 'signIn' ? '?/signIn' : '?/signUp'}
			use:enhance
			class="auth-form"
		>
			{#if mode === 'signUp'}
				<label>
					<span>{m.sign_in_name()}</span>
					<input name="name" autocomplete="name" required />
				</label>
			{/if}
			<label>
				<span>{m.sign_in_email()}</span>
				<input name="email" type="email" autocomplete="email" required />
			</label>
			<label>
				<span>{m.sign_in_password()}</span>
				<input
					name="password"
					type="password"
					autocomplete={mode === 'signIn' ? 'current-password' : 'new-password'}
					minlength={mode === 'signUp' ? 8 : undefined}
					required
				/>
			</label>
			<button type="submit">{m.sign_in_continue()}</button>
		</form>
	</section>
</main>

<style>
	.auth-page {
		display: grid;
		min-height: calc(100dvh - 10px);
		place-items: center;
		padding: 1.5rem;
	}

	.auth-card {
		width: min(100%, 28rem);
		padding: clamp(1.5rem, 5vw, 2.5rem);
		border: 1px solid var(--border-subtle);
		border-radius: 1.5rem;
		background: var(--surface-raised);
		box-shadow: var(--shadow-panel);
	}

	.brand-logo {
		display: block;
		width: 9.5rem;
		height: auto;
		margin: 0 0 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 6vw, 2.75rem);
		letter-spacing: -0.05em;
	}

	.intro {
		margin: 0.75rem 0 1.75rem;
		color: var(--text-muted);
	}

	.github-button {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		min-height: 2.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		padding: 0.75rem 1rem;
		color: var(--text-primary);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.github-button:hover {
		background: var(--surface-raised);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.divider::before,
	.divider::after {
		flex: 1;
		height: 1px;
		background: var(--border-subtle);
		content: '';
	}

	.mode-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
		margin: 0 0 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.75rem;
		background: var(--surface);
		padding: 0.25rem;
	}

	.mode-tabs button {
		min-height: 2.25rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.mode-tabs button.active {
		background: var(--surface-raised);
		color: var(--text-primary);
		box-shadow: var(--shadow-panel);
	}

	.auth-form {
		display: grid;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.4rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	input {
		width: 100%;
		border: 1px solid var(--border-strong);
		border-radius: 0.75rem;
		background: var(--surface);
		padding: 0.75rem 0.9rem;
		color: var(--text-primary);
	}

	button {
		min-height: 2.75rem;
		border: 0;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.auth-form > button {
		width: 100%;
	}
</style>
