<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import Notice from '#lib/components/ui/Notice.svelte';

	interface Preferences {
		autoplay: boolean;
		autoplayCount: number;
		personalizeSuggestions: boolean;
		learnFromListening: boolean;
		useLastfmHistory: boolean;
	}
	let {
		preferences,
		saved = false,
		failed = false,
		forgotten = false
	}: {
		preferences: Preferences;
		saved?: boolean;
		failed?: boolean;
		forgotten?: boolean;
	} = $props();

	const counts = [5, 10, 20];
	// Local mirror so dependent controls react before the form is saved.
	let autoplay = $derived(preferences.autoplay);
</script>

<section class="listening-prefs" aria-labelledby="listening-prefs-title">
	<h2 id="listening-prefs-title">{m.listening_prefs_title()}</h2>
	<p class="hint">{m.listening_prefs_description()}</p>

	{#if saved}<Notice tone="success">{m.listening_prefs_saved()}</Notice>{/if}
	{#if failed}<Notice tone="danger">{m.listening_prefs_error()}</Notice>{/if}
	{#if forgotten}<Notice tone="success">{m.listening_prefs_forgotten()}</Notice>{/if}

	<form method="POST" action="?/saveListeningPreferences" use:enhance>
		<label class="toggle">
			<input type="checkbox" name="autoplay" bind:checked={autoplay} />
			<span>{m.listening_prefs_autoplay()}</span>
		</label>
		<label class="select" class:muted={!autoplay}>
			<span>{m.listening_prefs_autoplay_count()}</span>
			<select name="autoplayCount" value={String(preferences.autoplayCount)}>
				{#each counts as count (count)}
					<option value={String(count)}>{count}</option>
				{/each}
			</select>
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				name="personalizeSuggestions"
				checked={preferences.personalizeSuggestions}
			/>
			<span>{m.listening_prefs_personalize()}</span>
		</label>
		<label class="toggle">
			<input type="checkbox" name="learnFromListening" checked={preferences.learnFromListening} />
			<span>{m.listening_prefs_learn()}</span>
		</label>
		<label class="toggle">
			<input type="checkbox" name="useLastfmHistory" checked={preferences.useLastfmHistory} />
			<span>
				{m.listening_prefs_lastfm()}
				<small>{m.listening_prefs_lastfm_hint()}</small>
			</span>
		</label>
		<div class="actions">
			<button type="submit" class="primary">{m.listening_prefs_save()}</button>
		</div>
	</form>
	<form method="POST" action="?/forgetListening" use:enhance class="actions">
		<button type="submit" class="secondary">{m.listening_prefs_forget()}</button>
	</form>
</section>

<style>
	.listening-prefs {
		display: grid;
		gap: 0.75rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		padding: 1rem;
	}
	h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
	}
	.hint,
	small {
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	small {
		display: block;
	}
	form {
		display: grid;
		gap: 0.6rem;
	}
	.toggle {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		min-height: 44px;
		cursor: pointer;
	}
	.toggle input {
		margin-top: 0.2rem;
		width: 1.1rem;
		height: 1.1rem;
		flex: none;
		accent-color: var(--action);
	}
	.select {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 44px;
		padding-left: 1.7rem;
	}
	.select.muted {
		opacity: 0.55;
	}
	select {
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-primary);
		padding: 0.35rem 0.5rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	button {
		min-height: 40px;
		padding: 0.4rem 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}
	.primary {
		border: 1px solid var(--action);
		background: var(--action);
		color: var(--action-contrast, #fff);
	}
	.secondary {
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-primary);
	}
</style>
