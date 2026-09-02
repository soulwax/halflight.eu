<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>{m.sign_in_title()} — Syn</title>
	<meta name="description" content={m.sign_in_subtitle()} />
</svelte:head>

<main class="auth-page">
	<section class="auth-card" aria-labelledby="sign-in-title">
		<p class="eyebrow">SYN</p>
		<h1 id="sign-in-title">{m.sign_in_title()}</h1>
		<p class="intro">{m.sign_in_subtitle()}</p>

		{#if form?.signInFailed}
			<p class="form-error" role="alert">{m.sign_in_error()}</p>
		{/if}

		<form method="post" action="?/signInAdministrator" use:enhance class="auth-form">
			<label>
				<span>{m.sign_in_username()}</span>
				<input name="username" autocomplete="username" required />
			</label>
			<label>
				<span>{m.sign_in_password()}</span>
				<input name="password" type="password" autocomplete="current-password" required />
			</label>
			<button type="submit">{m.sign_in_button()}</button>
		</form>

		<form method="post" action="?/signInSocial">
			<button class="secondary" type="submit">{m.sign_in_github()}</button>
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
		box-shadow: var(--shadow-raised);
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
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

	button.secondary {
		width: 100%;
		margin-top: 0.75rem;
		border: 1px solid var(--border-strong);
		background: transparent;
		color: var(--text-primary);
	}

	.form-error {
		margin: 0 0 1rem;
		border-radius: 0.75rem;
		background: var(--danger-subtle);
		padding: 0.75rem;
		color: var(--danger);
	}
</style>
