<script lang="ts">
	import {
		Check,
		ChevronRight,
		Clipboard,
		Code2,
		Loader2,
		Play,
		ShieldCheck
	} from '@lucide/svelte';
	import { apiGroups, endpointsForGroup, type ApiGroup, type ApiMethod } from '#lib/api-reference';
	import { m } from '#lib/paraglide/messages.js';
	import { resolve } from '$app/paths';

	const groupCopy: Record<ApiGroup, () => string> = {
		listening: m.api_reference_group_listening,
		music: m.api_reference_group_music,
		library: m.api_reference_group_library,
		storage: m.api_reference_group_storage
	};

	const endpointCopy: Record<string, { title: () => string; description: () => string }> = {
		search: { title: m.api_endpoint_search_title, description: m.api_endpoint_search_description },
		favorites: {
			title: m.api_endpoint_favorites_title,
			description: m.api_endpoint_favorites_description
		},
		'playback-state-read': {
			title: m.api_endpoint_playback_state_title,
			description: m.api_endpoint_playback_state_description
		},
		'playback-state-save': {
			title: m.api_endpoint_playback_save_title,
			description: m.api_endpoint_playback_save_description
		},
		'playback-intent': {
			title: m.api_endpoint_playback_intent_title,
			description: m.api_endpoint_playback_intent_description
		},
		'playlists-list': {
			title: m.api_endpoint_playlists_title,
			description: m.api_endpoint_playlists_description
		},
		'playlists-create': {
			title: m.api_endpoint_playlists_create_title,
			description: m.api_endpoint_playlists_create_description
		},
		'taste-profile': {
			title: m.api_endpoint_taste_title,
			description: m.api_endpoint_taste_description
		},
		'private-music-list': {
			title: m.api_endpoint_private_music_title,
			description: m.api_endpoint_private_music_description
		},
		'private-music-upload': {
			title: m.api_endpoint_private_music_upload_title,
			description: m.api_endpoint_private_music_upload_description
		},
		'private-music-export': {
			title: m.api_endpoint_private_music_export_title,
			description: m.api_endpoint_private_music_export_description
		},
		'private-music-download': {
			title: m.api_endpoint_private_music_download_title,
			description: m.api_endpoint_private_music_download_description
		},
		'track-metadata': {
			title: m.api_endpoint_track_metadata_title,
			description: m.api_endpoint_track_metadata_description
		},
		'track-stream': {
			title: m.api_endpoint_track_stream_title,
			description: m.api_endpoint_track_stream_description
		},
		'track-audio': {
			title: m.api_endpoint_track_audio_title,
			description: m.api_endpoint_track_audio_description
		}
	};

	const methodClass: Record<ApiMethod, string> = {
		GET: 'method-get',
		HEAD: 'method-head',
		POST: 'method-post',
		PUT: 'method-put',
		PATCH: 'method-patch',
		DELETE: 'method-delete'
	};

	let selectedId = $state('private-music-list');
	let copied = $state(false);
	let isRunning = $state(false);
	let result = $state<{ status: number; body: string } | null>(null);
	let resultError = $state<string | null>(null);

	const selected = $derived(
		apiGroups
			.flatMap((group) => endpointsForGroup(group))
			.find((endpoint) => endpoint.id === selectedId) ?? endpointsForGroup('storage')[0]
	);
	const selectedCopy = $derived(endpointCopy[selected.id]);

	async function copyPath(): Promise<void> {
		try {
			await navigator.clipboard.writeText(selected.path);
			copied = true;
			window.setTimeout(() => (copied = false), 1800);
		} catch {
			resultError = m.api_reference_copy_error();
		}
	}

	async function runRequest(): Promise<void> {
		if (!selected.examplePath || isRunning) return;
		isRunning = true;
		result = null;
		resultError = null;
		try {
			const response = await fetch(selected.examplePath, {
				headers: { Accept: 'application/json' }
			});
			const text = await response.text();
			let body = text || m.api_reference_empty_response();
			try {
				body = JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				// A download route may intentionally answer with text rather than JSON.
			}
			result = { status: response.status, body: body.slice(0, 12_000) };
		} catch {
			resultError = m.api_reference_request_error();
		} finally {
			isRunning = false;
		}
	}
</script>

<svelte:head>
	<title>{m.api_reference_title()} — {m.brand_name()}</title>
	<meta name="description" content={m.api_reference_subtitle()} />
</svelte:head>

<section class="api-reference" aria-labelledby="api-reference-title">
	<header class="api-reference-header">
		<div class="api-reference-title-mark" aria-hidden="true"><Code2 size={28} /></div>
		<div>
			<p class="eyebrow">HALFLIGHT // OWNER API</p>
			<h1 id="api-reference-title">{m.api_reference_title()}</h1>
			<p>{m.api_reference_subtitle()}</p>
		</div>
		<a class="api-spec-link" href={resolve('/api/openapi.json')} download="halflight-openapi.json">
			{m.api_reference_openapi_download()}
		</a>
	</header>

	<aside class="api-auth-note">
		<ShieldCheck size={18} aria-hidden="true" />
		<div>
			<strong>{m.api_reference_auth_title()}</strong>
			<p>{m.api_reference_auth_description()}</p>
		</div>
	</aside>

	<div class="api-workbench">
		<nav class="api-endpoint-list" aria-label={m.api_reference_operations()}>
			{#each apiGroups as group (group)}
				<section class="api-group" aria-labelledby={`api-group-${group}`}>
					<h2 id={`api-group-${group}`}>{groupCopy[group]()}</h2>
					<ul>
						{#each endpointsForGroup(group) as endpoint (endpoint.id)}
							{@const copy = endpointCopy[endpoint.id]}
							<li>
								<button
									type="button"
									class:api-operation-active={selected.id === endpoint.id}
									class="api-operation"
									onclick={() => {
										selectedId = endpoint.id;
										result = null;
										resultError = null;
									}}
								>
									<span class={`api-method ${methodClass[endpoint.method]}`}>{endpoint.method}</span
									>
									<span class="api-operation-copy">
										<strong>{copy.title()}</strong>
										<code>{endpoint.path}</code>
									</span>
									<ChevronRight size={16} aria-hidden="true" />
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</nav>

		<article class="api-operation-detail" aria-live="polite">
			<header class="api-detail-header">
				<div>
					<p class="api-group-label">{groupCopy[selected.group]()}</p>
					<h2>{selectedCopy.title()}</h2>
					<p>{selectedCopy.description()}</p>
				</div>
				<div class="api-path-row" aria-label={m.api_reference_path_label()}>
					<span class={`api-method ${methodClass[selected.method]}`}>{selected.method}</span>
					<code>{selected.path}</code>
					<button
						type="button"
						class="icon-button"
						onclick={copyPath}
						aria-label={m.api_reference_copy()}
					>
						{#if copied}<Check size={17} aria-hidden="true" />{:else}<Clipboard
								size={17}
								aria-hidden="true"
							/>{/if}
					</button>
				</div>
			</header>

			<div class="api-detail-grid">
				<section class="api-code-card" aria-labelledby="request-example-title">
					<h3 id="request-example-title">{m.api_reference_request_example()}</h3>
					<pre>{selected.requestExample ?? m.api_reference_no_body()}</pre>
				</section>
				<section class="api-code-card" aria-labelledby="response-example-title">
					<h3 id="response-example-title">{m.api_reference_response_example()}</h3>
					<pre>{selected.responseExample}</pre>
				</section>
			</div>

			<section class="api-console" aria-labelledby="api-console-title">
				<div class="api-console-heading">
					<div>
						<h3 id="api-console-title">{m.api_reference_console_title()}</h3>
						<p>
							{selected.examplePath
								? m.api_reference_console_ready()
								: m.api_reference_console_read_only()}
						</p>
					</div>
					<button
						type="button"
						class="api-run-button"
						disabled={!selected.examplePath || isRunning}
						onclick={runRequest}
					>
						{#if isRunning}<Loader2 size={16} class="animate-spin" />{:else}<Play
								size={16}
								fill="currentColor"
							/>{/if}
						{m.api_reference_send()}
					</button>
				</div>
				{#if resultError}
					<p class="api-console-error" role="alert">{resultError}</p>
				{:else if result}
					<div class="api-result">
						<p><strong>{m.api_reference_status()}</strong> {result.status}</p>
						<pre>{result.body}</pre>
					</div>
				{/if}
			</section>
		</article>
	</div>
</section>

<style>
	.api-reference {
		max-width: 88rem;
		margin: 0 auto;
		padding-bottom: 2rem;
	}
	.api-reference-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem 0;
	}
	.api-spec-link {
		margin-left: auto;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.78rem;
		font-weight: 700;
		text-decoration: none;
	}
	.api-spec-link:hover,
	.api-spec-link:focus-visible {
		border-color: var(--action);
		color: var(--action);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.api-reference-title-mark {
		display: grid;
		width: 3.2rem;
		height: 3.2rem;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--action) 48%, var(--border-subtle));
		border-radius: var(--radius-md);
		background: color-mix(in oklab, var(--action) 13%, var(--surface-raised));
		color: var(--action);
	}
	.api-reference h1,
	.api-reference h2,
	.api-reference h3,
	.api-reference p {
		margin: 0;
	}
	.api-reference h1 {
		font-size: clamp(1.75rem, 4vw, 2.5rem);
	}
	.api-reference-header p:last-child,
	.api-detail-header > div > p:last-child {
		color: var(--text-secondary);
	}
	.api-auth-note {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		margin-bottom: 1.25rem;
		padding: 1rem;
		border: 1px solid color-mix(in oklab, var(--accent-jade) 34%, var(--border-subtle));
		border-radius: var(--radius-md);
		background: color-mix(in oklab, var(--accent-jade) 8%, var(--surface-raised));
		color: var(--accent-jade);
	}
	.api-auth-note p {
		margin-top: 0.18rem;
		color: var(--text-secondary);
	}
	.api-workbench {
		display: grid;
		min-height: 43rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		grid-template-columns: minmax(16rem, 23rem) minmax(0, 1fr);
		overflow: hidden;
	}
	.api-endpoint-list {
		padding: 0.75rem;
		border-right: 1px solid var(--border-subtle);
		overflow: auto;
	}
	.api-group + .api-group {
		margin-top: 1.25rem;
	}
	.api-group h2,
	.api-group-label {
		margin: 0 0 0.45rem 0.45rem;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.api-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.api-operation {
		display: grid;
		width: 100%;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: center;
		padding: 0.65rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
	}
	.api-operation:hover,
	.api-operation:focus-visible,
	.api-operation-active {
		background: var(--surface-selected);
		outline: none;
	}
	.api-operation-active {
		box-shadow: inset 2px 0 0 var(--action);
	}
	.api-operation-copy {
		min-width: 0;
	}
	.api-operation-copy strong,
	.api-operation-copy code {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.api-operation-copy strong {
		font-size: 0.8rem;
	}
	.api-operation-copy code {
		margin-top: 0.18rem;
		color: var(--text-muted);
		font-size: 0.7rem;
	}
	.api-method {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: 0.22rem 0.32rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}
	.method-get {
		background: color-mix(in oklab, var(--accent-jade) 18%, transparent);
		color: var(--accent-jade);
	}
	.method-head {
		background: color-mix(in oklab, var(--editorial-sky) 22%, transparent);
		color: var(--editorial-sky);
	}
	.method-post {
		background: color-mix(in oklab, var(--action) 20%, transparent);
		color: var(--action);
	}
	.method-put,
	.method-patch {
		background: color-mix(in oklab, var(--editorial-blush) 27%, transparent);
		color: var(--text-primary);
	}
	.method-delete {
		background: var(--danger-subtle);
		color: var(--danger);
	}
	.api-operation-detail {
		min-width: 0;
		padding: clamp(1.15rem, 3vw, 2rem);
	}
	.api-detail-header {
		display: grid;
		gap: 1.25rem;
		padding-bottom: 1.35rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	.api-detail-header h2 {
		margin: 0.2rem 0 0.45rem;
		font-size: 1.45rem;
	}
	.api-path-row {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.55rem;
		padding: 0.7rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
	}
	.api-path-row code {
		min-width: 0;
		flex: 1;
		overflow: auto;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.icon-button {
		display: grid;
		width: 2rem;
		height: 2rem;
		flex: 0 0 auto;
		place-items: center;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.icon-button:hover,
	.icon-button:focus-visible {
		background: var(--surface-selected);
		color: var(--action);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.api-detail-grid {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.api-code-card,
	.api-console {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-canvas);
	}
	.api-code-card h3,
	.api-console-heading {
		padding: 0.75rem 0.9rem;
		border-bottom: 1px solid var(--border-subtle);
		font-size: 0.76rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.api-code-card pre,
	.api-result pre {
		margin: 0;
		padding: 0.9rem;
		overflow: auto;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.55;
		white-space: pre-wrap;
	}
	.api-console {
		margin-top: 1.25rem;
	}
	.api-console-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.api-console-heading h3 {
		margin: 0;
		font-size: 0.76rem;
	}
	.api-console-heading p {
		margin-top: 0.22rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		letter-spacing: normal;
		text-transform: none;
	}
	.api-run-button {
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		flex: 0 0 auto;
		padding: 0.55rem 0.75rem;
		border: 1px solid color-mix(in oklab, var(--action) 50%, var(--border-subtle));
		border-radius: var(--radius-sm);
		background: var(--action);
		color: #181818;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}
	.api-run-button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.api-result {
		border-top: 1px solid var(--border-subtle);
	}
	.api-result p {
		padding: 0.65rem 0.9rem;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.76rem;
	}
	.api-console-error {
		padding: 0.9rem;
		color: var(--danger);
		font-size: 0.85rem;
	}
	@media (max-width: 48rem) {
		.api-reference-header {
			align-items: flex-start;
			flex-wrap: wrap;
		}
		.api-spec-link {
			width: 100%;
			margin-left: 0;
			text-align: center;
		}
		.api-workbench {
			display: block;
			overflow: visible;
		}
		.api-endpoint-list {
			max-height: 18rem;
			border-right: 0;
			border-bottom: 1px solid var(--border-subtle);
		}
		.api-detail-grid {
			grid-template-columns: 1fr;
		}
		.api-console-heading {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
