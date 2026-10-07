<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { Database, RefreshCw } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { StorageOverview } from '#lib/storage';

	let { storage }: { storage: StorageOverview } = $props();
	let busy = $state(false);
	let feedback = $state<string | null>(null);
	let failed = $state(false);
	let artifact = $state<{ downloadUrl: string; expiresAt: string } | null>(null);

	function bytes(value: number): string {
		return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value / 1024 ** 2)} MiB`;
	}

	async function refresh(): Promise<void> {
		if (busy) return;
		busy = true;
		feedback = null;
		try {
			await invalidateAll();
		} catch {
			failed = true;
			feedback = m.storage_unavailable();
		} finally {
			busy = false;
		}
	}

	async function updateExport(remove = false): Promise<void> {
		if (busy) return;
		busy = true;
		feedback = null;
		try {
			const response = await fetch(
				remove && artifact ? artifact.downloadUrl : '/api/private-music/export?format=json',
				{
					method: remove ? 'DELETE' : 'POST'
				}
			);
			if (!response.ok) throw new Error('Export request failed');
			const body = await response.json();
			if (remove) {
				if (body.deleted !== true) throw new Error('Export not deleted');
				artifact = null;
				feedback = m.storage_export_deleted();
			} else {
				if (
					typeof body.id !== 'string' ||
					body.downloadUrl !== `/api/exports/${body.id}` ||
					!Number.isFinite(Date.parse(body.expiresAt))
				)
					throw new Error('Invalid export');
				artifact = { downloadUrl: body.downloadUrl, expiresAt: body.expiresAt };
			}
			failed = false;
		} catch {
			failed = true;
			feedback = m.storage_export_error();
		} finally {
			busy = false;
		}
	}
</script>

<section class="storage-card" aria-labelledby="mobile-storage-title" aria-busy={busy}>
	<div class="heading">
		<Database size={20} aria-hidden="true" />
		<div>
			<h2 id="mobile-storage-title">{m.storage_title()}</h2>
			<p>{m.storage_description()}</p>
		</div>
	</div>
	<ul>
		<li>
			<h3>{m.private_music_title()}</h3>
			{#if storage.privateMusic.status === 'ready'}
				<p>
					{m.private_music_storage({
						used: bytes(storage.privateMusic.data.usedBytes),
						total: bytes(storage.privateMusic.data.maxTotalBytes)
					})}
				</p>
				<meter
					min="0"
					max={storage.privateMusic.data.maxTotalBytes}
					value={storage.privateMusic.data.usedBytes}
					aria-label={m.private_music_title()}
				></meter>
			{:else}<p role="status">{m.storage_unavailable()}</p>{/if}
			{#if !storage.privateMusicEnabled}<p>{m.private_music_storage_unavailable()}</p>{/if}
			<a href={resolve('/(mobile)/library') + '?tab=private'}>{m.private_music_title()}</a>
		</li>
		<li>
			<h3>{m.storage_session()}</h3>
			<p>
				{storage.playback.status === 'ready'
					? m.storage_session_counts({
							queue: storage.playback.data.queueCount,
							history: storage.playback.data.historyCount
						})
					: m.storage_unavailable()}
			</p>
			<a href={resolve('/(mobile)/now/queue')}>{m.player_queue()}</a>
		</li>
		<li>
			<h3>{m.storage_playlists()}</h3>
			<p>
				{storage.playlists.status === 'ready'
					? m.storage_playlist_count({ count: storage.playlists.data.count })
					: m.storage_unavailable()}
			</p>
			<a href={resolve('/(mobile)/library')}>{m.now_tab_library()}</a>
		</li>
		<li>
			<h3>{m.storage_preferences()}</h3>
			<p>
				{storage.preferences.status !== 'ready'
					? m.storage_unavailable()
					: storage.preferences.data.streamingSaved || storage.preferences.data.appearanceSaved
						? m.storage_preferences_saved()
						: m.storage_preferences_defaults()}
			</p>
		</li>
		<li>
			<h3>{m.storage_exports()}</h3>
			<p>{m.storage_exports_description()}</p>
			{#if storage.privateMusic.status === 'ready' && storage.privateMusic.data.fileCount > 0}
				<div class="actions">
					<a href="/api/private-music/export?format=m3u8" download>{m.storage_export_m3u()}</a>
					<a href="/api/private-music/export?format=json" download>{m.storage_export_json()}</a>
					{#if storage.exportsEnabled && !artifact}<button
							type="button"
							disabled={busy}
							onclick={() => updateExport()}>{m.storage_export_create()}</button
						>{/if}
				</div>
			{/if}
			{#if artifact}
				<p>
					{m.storage_export_expiry({
						time: new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(
							new Date(artifact.expiresAt)
						)
					})}
				</p>
				<div class="actions">
					<a href={artifact.downloadUrl} download>{m.storage_export_download()}</a>
					<button type="button" disabled={busy} onclick={() => updateExport(true)}
						>{m.storage_export_delete()}</button
					>
				</div>
			{/if}
			<p class="status">{storage.exportsEnabled ? m.storage_configured() : m.storage_disabled()}</p>
		</li>
		<li>
			<h3>{m.storage_audio_cache()}</h3>
			<p>{m.storage_audio_cache_description()}</p>
			<p class="status">
				{storage.audioCacheEnabled ? m.storage_configured() : m.storage_disabled()}
			</p>
		</li>
	</ul>
	{#if feedback}<p class:failed role={failed ? 'alert' : 'status'}>{feedback}</p>{/if}
	<button type="button" disabled={busy} onclick={refresh}
		><RefreshCw size={16} aria-hidden="true" />{m.storage_refresh()}</button
	>
</section>

<style>
	.storage-card {
		margin-top: 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		padding: 1.15rem;
	}
	.heading {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.heading :global(svg) {
		flex-shrink: 0;
		color: var(--action);
		margin-top: 0.1rem;
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: 1rem;
	}
	p {
		color: var(--text-muted);
		margin-top: 0.35rem;
		overflow-wrap: anywhere;
	}
	ul {
		list-style: none;
		margin: 1rem 0;
		padding: 0;
	}
	li {
		padding: 1rem 0;
		border-top: 1px solid var(--border-subtle);
	}
	meter {
		width: 100%;
		height: 1rem;
		margin-top: 0.5rem;
	}
	.actions {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	a,
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 3rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 0.5rem 0.75rem;
		font: inherit;
		color: var(--text-primary);
		background: var(--surface-canvas);
		text-decoration: none;
		cursor: pointer;
	}
	li > a {
		margin-top: 0.5rem;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.status {
		font-size: 0.875rem;
	}
	.failed {
		color: var(--danger);
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
</style>
