<script lang="ts">
	import { FolderPlus, ListPlus, ListStart, MoreHorizontal, Play, Radio } from '@lucide/svelte';
	import DropdownMenu, { type DropdownMenuItem } from '#lib/components/ui/DropdownMenu.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let {
		track,
		contextTracks,
		provenance,
		onStartRadio,
		radioDisabled = false,
		align = 'end',
		side = 'bottom',
		triggerClass = '',
		class: className = ''
	}: {
		track: TrackSummary;
		contextTracks?: TrackSummary[];
		provenance?: string;
		onStartRadio?: () => void | Promise<void>;
		radioDisabled?: boolean;
		align?: 'start' | 'center' | 'end';
		side?: 'top' | 'right' | 'bottom' | 'left';
		triggerClass?: string;
		class?: string;
	} = $props();

	async function startRadio() {
		try {
			const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/radio`);
			if (!response.ok) throw new Error('Radio unavailable');
			const result = (await response.json()) as { tracks?: TrackSummary[] };
			const radioTracks = result.tracks ?? [];
			if (!radioTracks.length) throw new Error('Radio empty');

			player.play(radioTracks[0], radioTracks, m.player_radio_provenance({ title: track.title }));
		} catch {
			// Fail gracefully
		}
	}

	const menuItems = $derived<DropdownMenuItem[]>([
		{
			id: 'play-now',
			label: m.track_action_play_now(),
			icon: Play,
			onSelect: () => player.play(track, contextTracks ?? [track], provenance)
		},
		{
			id: 'play-next',
			label: m.track_action_play_next(),
			icon: ListStart,
			onSelect: () => player.playNext(track, provenance)
		},
		{
			id: 'add-to-queue',
			label: m.track_action_add_to_queue(),
			icon: ListPlus,
			onSelect: () => player.addToQueue(track, provenance)
		},
		{
			id: 'start-radio',
			label: m.track_action_start_radio(),
			icon: Radio,
			disabled: radioDisabled,
			onSelect: () => void (onStartRadio ? onStartRadio() : startRadio())
		},
		{
			id: 'add-to-playlist',
			label: m.track_action_add_to_playlist(),
			icon: FolderPlus,
			separator: true,
			onSelect: () => customPlaylists.promptAddToPlaylist(track)
		}
	]);
</script>

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

<style>
	:global(.track-menu-trigger) {
		width: 1.9rem;
		height: 1.9rem;
	}
</style>
