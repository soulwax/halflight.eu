<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	type TokenRecord = {
		accessToken: string;
		refreshToken: string;
		tokenType: string;
		scopes: string[];
		expiresAt: string;
	};
	type TokenBundle = { browse: TokenRecord | null; playback: TokenRecord | null };
	type TokenName = 'browse' | 'playback';
	type TokenField = 'accessToken' | 'refreshToken';

	let revealed = $state(false);
	let loading = $state(false);
	let error = $state<'unavailable' | 'connection' | 'copy' | null>(null);
	let records = $state<TokenBundle | null>(null);
	let copied = $state<string | null>(null);

	function clearRecords() {
		records = null;
		revealed = false;
		copied = null;
	}

	async function toggleReveal() {
		if (revealed) {
			clearRecords();
			error = null;
			return;
		}
		if (loading) return;

		loading = true;
		error = null;
		try {
			const response = await fetch('/api/tidal/debug-tokens', {
				cache: 'no-store',
				credentials: 'same-origin',
				headers: { accept: 'application/json' }
			});
			if (response.status === 404) {
				error = 'connection';
				return;
			}
			if (!response.ok) throw new Error('Token records unavailable');
			records = (await response.json()) as TokenBundle;
			revealed = true;
		} catch {
			error = 'unavailable';
		} finally {
			loading = false;
		}
	}

	async function copyToken(name: TokenName, field: TokenField) {
		const value = records?.[name]?.[field];
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			copied = `${name}-${field}`;
			error = null;
		} catch {
			error = 'copy';
		}
	}

	function displayExpiry(value: string): string {
		return new Date(value).toLocaleString();
	}

	onDestroy(clearRecords);
</script>

<section class="token-panel" aria-labelledby="tidal-debug-title">
	<div class="panel-heading">
		<div>
			<h2 id="tidal-debug-title">{m.tidal_settings_debug_title()}</h2>
			<p>{m.tidal_settings_debug_description()}</p>
		</div>
		<button type="button" onclick={toggleReveal} disabled={loading} aria-expanded={revealed}>
			{loading
				? m.tidal_settings_debug_loading()
				: revealed
					? m.tidal_settings_debug_hide()
					: m.tidal_settings_debug_reveal()}
		</button>
	</div>
	<p class="warning">{m.tidal_settings_debug_warning()}</p>

	{#if error === 'connection'}
		<p class="error" role="status">{m.tidal_settings_debug_connection_required()}</p>
	{:else if error === 'unavailable'}
		<p class="error" role="alert">{m.tidal_settings_debug_unavailable()}</p>
	{:else if error === 'copy'}
		<p class="error" role="alert">{m.tidal_settings_debug_copy_failed()}</p>
	{/if}

	{#if revealed && records}
		{#each ['browse', 'playback'] as const as name (name)}
			{@const record = records[name]}
			<section class="token-record" aria-labelledby={`tidal-debug-${name}`}>
				<h3 id={`tidal-debug-${name}`}>
					{name === 'browse'
						? m.tidal_settings_debug_browse_title()
						: m.tidal_settings_debug_playback_title()}
				</h3>
				{#if record}
					{#each ['accessToken', 'refreshToken'] as const as field (field)}
						{@const key = `${name}-${field}`}
						<div class="token-field">
							<label for={`tidal-token-${key}`}>
								{field === 'accessToken'
									? m.tidal_settings_debug_access_token()
									: m.tidal_settings_debug_refresh_token()}
							</label>
							<div class="token-value-row">
								<input
									id={`tidal-token-${key}`}
									type="text"
									value={record[field]}
									readonly
									autocomplete="off"
									spellcheck="false"
								/>
								<button type="button" onclick={() => copyToken(name, field)}>
									{copied === key ? m.tidal_settings_debug_copied() : m.tidal_settings_debug_copy()}
								</button>
							</div>
						</div>
					{/each}
					<dl>
						<div>
							<dt>{m.tidal_settings_debug_token_type()}</dt>
							<dd>{record.tokenType}</dd>
						</div>
						<div>
							<dt>{m.tidal_settings_debug_scopes()}</dt>
							<dd>{record.scopes.join(', ') || '—'}</dd>
						</div>
						<div>
							<dt>{m.tidal_settings_debug_expires()}</dt>
							<dd>{displayExpiry(record.expiresAt)}</dd>
						</div>
					</dl>
				{:else}
					<p>{m.tidal_settings_debug_not_available()}</p>
				{/if}
			</section>
		{/each}
	{/if}
</section>

<style>
	.token-panel {
		padding: 1.25rem;
		border: var(--module-border);
		border-radius: var(--module-radius);
		background: var(--module-bg);
		color: var(--text-primary);
	}
	.panel-heading,
	.token-value-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.panel-heading p,
	.warning,
	.token-record p {
		margin: 0.35rem 0 0;
		color: var(--text-secondary);
	}
	h2,
	h3 {
		margin: 0;
	}
	.warning {
		margin-top: 1rem;
		color: var(--text-secondary);
	}
	button {
		min-height: 2.75rem;
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--control-radius, 0.5rem);
		background: var(--surface-raised, var(--module-bg));
		color: var(--text-primary);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.7;
	}
	.token-record {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}
	.token-field {
		margin-top: 0.75rem;
	}
	.token-field label,
	.token-field input {
		display: block;
		width: 100%;
	}
	.token-field label,
	dt {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}
	.token-value-row input {
		min-width: 0;
		padding: 0.65rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.4rem;
		background: var(--surface-sunken, var(--module-bg));
		color: var(--text-primary);
		font: inherit;
		font-family: var(--font-mono, monospace);
	}
	dl {
		display: grid;
		gap: 0.4rem;
		margin: 1rem 0 0;
	}
	dl div {
		display: grid;
		grid-template-columns: minmax(7rem, 0.35fr) 1fr;
		gap: 0.75rem;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.error {
		margin: 0.75rem 0 0;
		color: var(--danger, #b42318);
	}
	@media (max-width: 34rem) {
		.token-panel {
			padding: 1rem;
		}
		.panel-heading {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
