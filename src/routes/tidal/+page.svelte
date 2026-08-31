<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const status = $derived(data.status);

	// --- interactive: catalogue search -------------------------------------------
	let searchQuery = $state('');
	let searchState = $state<{ loading: boolean; error?: string; result?: unknown }>({
		loading: false
	});

	async function runSearch(event: SubmitEvent) {
		event.preventDefault();
		if (!searchQuery.trim()) return;
		searchState = { loading: true };
		try {
			const params = new URLSearchParams({
				'filter[query]': searchQuery.trim(),
				include: 'tracks,albums,artists'
			});
			const res = await fetch(`/tidal/api/searchResults?${params}`);
			searchState = {
				loading: false,
				error: res.ok ? undefined : `HTTP ${res.status}`,
				result: await res.json()
			};
		} catch (err) {
			searchState = {
				loading: false,
				error: err instanceof Error ? err.message : 'Request failed'
			};
		}
	}

	// --- interactive: raw API console ------------------------------------------
	let consoleMethod = $state<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
	let consolePath = $state('users/me');
	let consoleBody = $state('');
	let consoleState = $state<{ loading: boolean; status?: number; result?: string }>({
		loading: false
	});

	async function runConsole(event: SubmitEvent) {
		event.preventDefault();
		consoleState = { loading: true };
		try {
			const init: RequestInit = { method: consoleMethod };
			if (consoleMethod !== 'GET' && consoleBody.trim()) {
				init.body = consoleBody;
				init.headers = { 'content-type': 'application/vnd.api+json' };
			}
			const res = await fetch(`/tidal/api/${consolePath.replace(/^\/+/, '')}`, init);
			const text = await res.text();
			let pretty = text;
			try {
				pretty = JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				/* leave as-is */
			}
			consoleState = { loading: false, status: res.status, result: pretty };
		} catch (err) {
			consoleState = {
				loading: false,
				result: err instanceof Error ? err.message : 'Request failed'
			};
		}
	}
</script>

<svelte:head><title>TIDAL — Syn</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6 p-6">
	<header class="flex items-baseline justify-between">
		<div>
			<h1 class="text-2xl font-semibold">{m.tidal_title()}</h1>
			<p class="text-sm text-gray-500">{m.tidal_subtitle()}</p>
		</div>
		<a href="/demo" class="text-sm text-blue-600 hover:underline">← demos</a>
	</header>

	{#if data.messages.error}
		<p class="rounded-md bg-red-100 px-4 py-2 text-sm text-red-800">
			Authorization failed: {data.messages.error}
		</p>
	{:else if data.messages.connected}
		<p class="rounded-md bg-green-100 px-4 py-2 text-sm text-green-800">TIDAL account connected.</p>
	{:else if data.messages.disconnected}
		<p class="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700">
			TIDAL account disconnected.
		</p>
	{/if}

	<!-- connection status -->
	<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span
					class="inline-block h-2.5 w-2.5 rounded-full {status.connected
						? 'bg-green-500'
						: 'bg-gray-400'}"
				></span>
				<span class="font-medium">
					{status.connected ? m.tidal_connected() : m.tidal_not_connected()}
				</span>
			</div>

			<div class="flex gap-2">
				{#if status.configured}
					<a
						href="/tidal/connect"
						class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white transition hover:bg-blue-700"
					>
						{status.connected ? m.tidal_reconnect() : m.tidal_connect()}
					</a>
				{/if}
				{#if status.connected}
					<form method="POST" action="/tidal/disconnect">
						<button
							class="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
						>
							{m.tidal_disconnect()}
						</button>
					</form>
				{/if}
			</div>
		</div>

		{#if !status.configured}
			<p class="mt-3 text-sm text-amber-700 dark:text-amber-500">{m.tidal_not_configured()}</p>
			{#if status.configError}<p class="mt-1 text-xs text-gray-500">{status.configError}</p>{/if}
		{:else if status.error}
			<p class="mt-3 text-sm text-red-700">{status.error}</p>
		{:else if status.connected}
			<dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				<dt class="text-gray-500">Scopes</dt>
				<dd class="font-mono text-xs break-all">{status.scopes?.join(' ')}</dd>
				<dt class="text-gray-500">Token expires</dt>
				<dd>{status.expiresAt}{status.stale ? ' (refreshing on next use)' : ''}</dd>
				<dt class="text-gray-500">Obtained</dt>
				<dd>{status.obtainedAt}</dd>
				{#if status.tidalUserId}
					<dt class="text-gray-500">TIDAL user id</dt>
					<dd>{status.tidalUserId}</dd>
				{/if}
			</dl>
		{/if}
	</section>

	{#if status.connected}
		<!-- account -->
		{#if data.account}
			<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<h2 class="mb-2 font-medium">Account</h2>
				{#if data.account.ok}
					{@const attrs =
						(data.account.value as { data?: { attributes?: Record<string, unknown> } }).data
							?.attributes ?? {}}
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						{#each Object.entries(attrs) as [key, value] (key)}
							<dt class="text-gray-500">{key}</dt>
							<dd class="break-all">
								{typeof value === 'object' ? JSON.stringify(value) : String(value)}
							</dd>
						{/each}
					</dl>
				{:else}
					<p class="text-sm text-red-700">{data.account.error}</p>
				{/if}
			</section>
		{/if}

		<!-- library -->
		<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h2 class="mb-3 font-medium">Library</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each data.collections as col (col.label)}
					<div>
						<h3 class="text-sm font-semibold capitalize">
							{col.label}
							{#if col.ok && col.summary}
								<span class="text-gray-400">
									· {col.summary.count}{col.summary.hasMore ? '+' : ''}
								</span>
							{/if}
						</h3>
						{#if !col.ok}
							<p class="text-xs text-red-700">{col.error}</p>
						{:else if col.summary}
							<ul class="mt-1 space-y-0.5 text-sm text-gray-600 dark:text-gray-300">
								{#each col.summary.items as item (item.type + item.id)}
									<li class="truncate">{item.title}</li>
								{/each}
								{#if col.summary.items.length === 0}<li class="text-gray-400">empty</li>{/if}
							</ul>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- mixes -->
		<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h2 class="mb-3 font-medium">Personal mixes</h2>
			<div class="grid gap-4 sm:grid-cols-3">
				{#each data.mixes as mix (mix.label)}
					<div>
						<h3 class="text-sm font-semibold capitalize">{mix.label}</h3>
						{#if !mix.ok}
							<p class="text-xs text-red-700">{mix.error}</p>
						{:else if mix.summary}
							<ul class="mt-1 space-y-0.5 text-sm text-gray-600 dark:text-gray-300">
								{#each mix.summary.items as item (item.type + item.id)}
									<li class="truncate">{item.title}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- search -->
		<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h2 class="mb-3 font-medium">Search</h2>
			<form onsubmit={runSearch} class="flex gap-2">
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="artist, album or track…"
					class="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
				/>
				<button
					class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={searchState.loading}
				>
					{searchState.loading ? '…' : 'Search'}
				</button>
			</form>
			{#if searchState.error}
				<p class="mt-2 text-sm text-red-700">{searchState.error}</p>
			{/if}
			{#if searchState.result}
				<pre
					class="mt-3 max-h-72 overflow-auto rounded-md bg-gray-950 p-3 text-xs text-gray-100">{JSON.stringify(
						searchState.result,
						null,
						2
					)}</pre>
			{/if}
		</section>

		<!-- raw API console -->
		<section class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h2 class="mb-1 font-medium">API console</h2>
			<p class="mb-3 text-xs text-gray-500">
				Authenticated pass-through to <code>openapi.tidal.com/v2</code>. Path only — no host.
			</p>
			<form onsubmit={runConsole} class="space-y-2">
				<div class="flex gap-2">
					<select
						bind:value={consoleMethod}
						class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
					>
						<option>GET</option>
						<option>POST</option>
						<option>PATCH</option>
						<option>DELETE</option>
					</select>
					<input
						bind:value={consolePath}
						class="flex-1 rounded-md border border-gray-300 px-3 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
						placeholder="playlists/xxxx/relationships/items?include=items"
					/>
					<button
						class="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900 disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900"
						disabled={consoleState.loading}
					>
						{consoleState.loading ? '…' : 'Send'}
					</button>
				</div>
				{#if consoleMethod !== 'GET'}
					<textarea
						bind:value={consoleBody}
						rows="3"
						placeholder={'{ "data": [ { "id": "…", "type": "…" } ] }'}
						class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900"
					></textarea>
				{/if}
			</form>
			{#if consoleState.result}
				<p class="mt-2 text-xs text-gray-500">status {consoleState.status}</p>
				<pre
					class="mt-1 max-h-96 overflow-auto rounded-md bg-gray-950 p-3 text-xs text-gray-100">{consoleState.result}</pre>
			{/if}
		</section>
	{/if}
</div>
