<script lang="ts">
	import { FolderPlus, ListPlus, ListStart, MoreHorizontal, Play, Radio } from '@lucide/svelte';
	import DropdownMenu, { type DropdownMenuItem } from '#lib/components/ui/DropdownMenu.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { onDestroy } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let {
		track,
		contextTracks,
		contextIndex,
		provenance,
		onStartRadio,
		radioDisabled = false,
		showPlayNow = true,
		align = 'end',
		side = 'bottom',
		triggerClass = '',
		mobile = false,
		class: className = ''
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		contextIndex?: number;
		provenance?: string;
		onStartRadio?: () => void | Promise<void>;
		radioDisabled?: boolean;
		showPlayNow?: boolean;
		align?: 'start' | 'center' | 'end';
		side?: 'top' | 'right' | 'bottom' | 'left';
		triggerClass?: string;
		mobile?: boolean;
		class?: string;
	} = $props();
	let open = $state(false);
	let feedback = $state('');
	let radioError = $state(false);
	let radioLoading = $state(false);
	let radioRequest: AbortController | null = null;
	onDestroy(() => radioRequest?.abort());

	function enqueue(next: boolean) {
		if (next) player.playNext(track, provenance);
		else player.addToQueue(track, provenance);
		feedback = next
			? m.now_library_next_added({ title: track.title })
			: m.now_library_added({ title: track.title });
	}

	async function startRadio() {
		if (radioLoading) return;
		radioError = false;
		radioLoading = true;
		const controller = new AbortController();
		radioRequest = controller;
		try {
			if (onStartRadio) {
				open = false;
				await onStartRadio();
				return;
			}
			const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/radio`, {
				signal: controller.signal
			});
			if (!response.ok) throw new Error('Radio unavailable');
			const result = (await response.json()) as { tracks?: TrackSummary[] };
			const radioTracks = result.tracks ?? [];
			if (!radioTracks.length) throw new Error('Radio empty');

			if (!controller.signal.aborted) {
				player.play(radioTracks[0], radioTracks, m.player_radio_provenance({ title: track.title }));
				open = false;
			}
		} catch {
			if (!controller.signal.aborted) radioError = true;
		} finally {
			radioLoading = false;
		}
	}

	const menuItems = $derived<DropdownMenuItem[]>(
		[
			{
				id: 'play-now',
				label: m.track_action_play_now(),
				icon: Play,
				onSelect: () => {
					if (contextIndex === undefined) {
						player.play(track, contextTracks ?? [track], provenance);
					} else {
						player.play(track, contextTracks ?? [track], provenance, contextIndex);
					}
					open = false;
				}
			},
			{
				id: 'play-next',
				label: m.track_action_play_next(),
				icon: ListStart,
				onSelect: () => enqueue(true)
			},
			{
				id: 'add-to-queue',
				label: m.track_action_add_to_queue(),
				icon: ListPlus,
				onSelect: () => enqueue(false)
			},
			{
				id: 'start-radio',
				label: m.track_action_start_radio(),
				icon: Radio,
				disabled: radioDisabled || radioLoading,
				onSelect: () => void startRadio()
			},
			{
				id: 'add-to-playlist',
				label: m.track_action_add_to_playlist(),
				icon: FolderPlus,
				separator: true,
				onSelect: () => {
					open = false;
					customPlaylists.promptAddToPlaylist(track);
				}
			}
		].filter((item) => showPlayNow || item.id !== 'play-now')
	);
</script>

{#if mobile}
	<button
		type="button"
		class="track-mobile-trigger {triggerClass}"
		aria-label={m.track_action_menu()}
		onclick={() => {
			feedback = '';
			radioError = false;
			open = true;
		}}><MoreHorizontal size={22} aria-hidden="true" /></button
	>
	<Dialog
		bind:open
		title={track.title}
		description={track.artists.map((artist) => artist.name).join(', ')}
		contentClass="mobile-track-sheet"
		onOpenChange={(value) => {
			if (!value) radioRequest?.abort();
		}}
	>
		<div class="mobile-track-actions-list">
			{#each menuItems as item (item.id)}
				<button type="button" disabled={item.disabled} onclick={item.onSelect}>
					{#if item.icon}{@const Icon = item.icon}<Icon size={20} />{/if}{item.label}
				</button>
			{/each}
			{#if radioLoading && !onStartRadio}<p role="status">{m.player_starting_radio()}</p>{/if}
			{#if feedback}<p role="status">{feedback}</p>{/if}
			{#if radioError}<p role="alert">{m.player_radio_unavailable()}</p>{/if}
		</div>
	</Dialog>
{:else}
	<DropdownMenu
		items={menuItems}
		{align}
		{side}
		triggerClass="track-menu-trigger {triggerClass}"
		triggerAriaLabel={m.track_action_menu()}
		class={className}
	>
		{#snippet trigger()}
			<MoreHorizontal size={15} />
		{/snippet}
	</DropdownMenu>
	{#if feedback}<span class="action-feedback" role="status">{feedback}</span>{/if}
	{#if radioError}<span class="action-feedback" role="alert">{m.player_radio_unavailable()}</span
		>{/if}
{/if}

<style>
	:global(.track-menu-trigger) {
		width: 1.9rem;
		height: 1.9rem;
	}
	.track-mobile-trigger {
		display: grid;
		flex: none;
		width: 48px;
		height: 48px;
		padding: 0;
		place-items: center;
		background: transparent;
		color: var(--text-secondary);
		border: 0;
		border-radius: var(--radius-full);
		cursor: pointer;
		touch-action: manipulation;
		transition: background-color var(--dur-fast) ease;
	}
	.track-mobile-trigger:hover,
	.track-mobile-trigger:active {
		background: var(--surface-selected);
	}
	.track-mobile-trigger:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	.mobile-track-actions-list {
		display: grid;
		gap: 0.25rem;
	}
	.mobile-track-actions-list button {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		min-height: 48px;
		padding: 0.65rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.mobile-track-actions-list button:hover {
		background: var(--surface-selected);
	}
	.mobile-track-actions-list button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mobile-track-actions-list p,
	.action-feedback {
		font-size: var(--fs-sm);
		color: var(--text-secondary);
	}
	:global(.dialog-content.mobile-track-sheet) {
		top: auto;
		bottom: 0.5rem;
		left: 50%;
		width: min(34rem, calc(100% - 1rem));
		max-height: calc(100dvh - 2rem);
		transform: translateX(-50%);
		padding-bottom: env(safe-area-inset-bottom);
		animation: none;
	}
</style>
