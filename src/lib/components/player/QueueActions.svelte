<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists, type CustomPlaylist } from '#lib/player/customPlaylists.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { Check, ListPlus } from '@lucide/svelte';

	let {
		part = 'both',
		compact = false
	}: {
		/** Which actions to render; mobile places save and clear in different spots. */
		part?: 'both' | 'save' | 'clear';
		/** Icon button for save, quiet text button for clear. */
		compact?: boolean;
	} = $props();

	let saveOpen = $state(false);
	let clearOpen = $state(false);
	let title = $state('');
	let tracks = $state<TrackSummary[]>([]);
	let playlistId = '';
	let pending = $state(false);
	let failed = $state(false);
	let savedTitle = $state('');
	let request: AbortController | null = null;
	onDestroy(() => request?.abort());

	function openSave() {
		tracks = player.currentTrack ? [player.currentTrack, ...player.queue] : [...player.queue];
		title = m.player_queue();
		playlistId = crypto.randomUUID();
		failed = false;
		savedTitle = '';
		saveOpen = true;
	}
	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (pending || !title.trim() || !tracks.length) return;
		request = new AbortController();
		pending = true;
		failed = false;
		try {
			const response = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id: playlistId,
					title: title.trim(),
					items: tracks,
					syncTidal: false
				}),
				signal: request.signal
			});
			if (!response.ok) throw new Error('save_failed');
			const { playlist } = (await response.json()) as { playlist: CustomPlaylist };
			if (!playlist?.id) throw new Error('save_failed');
			customPlaylists.createPlaylist(
				playlist.title,
				playlist.description,
				playlist.items,
				playlist
			);
			savedTitle = playlist.title;
			saveOpen = false;
		} catch {
			if (!request.signal.aborted) failed = true;
		} finally {
			pending = false;
		}
	}
</script>

<div class="queue-actions" class:compact>
	{#if part !== 'clear' && (player.queueCount || player.currentTrack)}
		{#if compact}
			<button
				type="button"
				class="icon-action"
				onclick={openSave}
				disabled={pending}
				aria-label={m.player_save_queue()}
				title={m.player_save_queue()}
			>
				{#if savedTitle}<Check size={20} aria-hidden="true" />{:else}<ListPlus
						size={20}
						aria-hidden="true"
					/>{/if}
			</button>
		{:else}
			<button type="button" onclick={openSave} disabled={pending}>{m.player_save_queue()}</button>
		{/if}
	{/if}
	{#if part !== 'save' && player.queueCount}
		<button type="button" class:text-action={compact} onclick={() => (clearOpen = true)}
			>{m.player_clear_queue()}</button
		>
	{/if}
</div>
{#if savedTitle}<p role="status" class:sr-only={compact}>
		{m.player_queue_save_success({ title: savedTitle })}
	</p>{/if}

{#if part !== 'clear'}<Dialog
		bind:open={saveOpen}
		title={m.player_save_queue()}
		description={m.player_queue_save_description()}
	>
		<form onsubmit={save} aria-busy={pending}>
			<label for="queue-playlist-name">{m.player_queue_save_name()}</label>
			<input
				id="queue-playlist-name"
				bind:value={title}
				required
				maxlength="200"
				disabled={pending}
			/>
			{#if failed}<p role="alert">{m.player_queue_save_error()}</p>{/if}
			<div class="dialog-actions">
				<button type="button" disabled={pending} onclick={() => (saveOpen = false)}
					>{m.playlist_cancel()}</button
				>
				<button type="submit" disabled={pending || !title.trim()}
					>{pending ? m.player_queue_save_pending() : m.player_queue_save_action()}</button
				>
			</div>
		</form>
	</Dialog>{/if}
{#if part !== 'save'}<Dialog
		bind:open={clearOpen}
		title={m.player_clear_queue()}
		description={m.player_queue_clear_description()}
	>
		<div class="dialog-actions">
			<button type="button" onclick={() => (clearOpen = false)}>{m.playlist_cancel()}</button>
			<button
				type="button"
				onclick={() => {
					player.clearQueue();
					clearOpen = false;
				}}>{m.player_clear_queue()}</button
			>
		</div>
	</Dialog>{/if}

<style>
	.queue-actions,
	.dialog-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	button {
		min-height: 48px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--action);
		cursor: pointer;
		font: inherit;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.compact {
		flex-wrap: nowrap;
		gap: 0;
	}
	.icon-action {
		display: grid;
		width: 44px;
		min-height: 44px;
		padding: 0;
		place-items: center;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
	}
	.text-action {
		min-height: 44px;
		padding: 0 0.25rem;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		font-weight: 600;
	}
	.icon-action:active,
	.text-action:active {
		color: var(--text-primary);
	}
	@media (hover: hover) {
		.icon-action:hover,
		.text-action:hover {
			color: var(--text-primary);
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
	form {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
	}
	input {
		min-width: 0;
		width: 100%;
		min-height: 48px;
		padding: 0.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-canvas);
		color: var(--text-primary);
		font: inherit;
	}
	.dialog-actions {
		padding: 1rem;
	}
	form .dialog-actions {
		padding: 0;
	}
	p {
		color: var(--text-muted);
		font-size: 0.875rem;
	}
	p[role='alert'] {
		color: var(--danger);
	}
</style>
