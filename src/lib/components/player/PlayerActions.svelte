<script lang="ts">
	import {
		ChevronDown,
		ChevronUp,
		ExternalLink,
		ListMusic,
		Mic2,
		MoreHorizontal,
		PictureInPicture2,
		Plus,
		X
	} from '@lucide/svelte';
	import DropdownMenu, { type DropdownMenuItem } from '#lib/components/ui/DropdownMenu.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import PlayerVolume from './PlayerVolume.svelte';

	let {
		track,
		floating,
		isNarrow,
		tidalUrl
	}: { track: TrackSummary; floating: boolean; isNarrow: boolean; tidalUrl: string } = $props();

	function openTidal() {
		window.open(tidalUrl, '_blank', 'noopener,noreferrer');
	}

	const moreActions = $derived.by<DropdownMenuItem[]>(() => {
		const actions: DropdownMenuItem[] = [
			{
				id: 'add-to-playlist',
				label: m.player_add_to_playlist(),
				icon: Plus,
				onSelect: () => customPlaylists.promptAddToPlaylist(track)
			}
		];

		if (!isNarrow) {
			actions.push({
				id: 'toggle-dock',
				label: floating ? m.player_dock() : m.player_undock(),
				icon: PictureInPicture2,
				onSelect: () => player.toggleDock()
			});
		}

		actions.push(
			{
				id: 'open-tidal',
				label: m.player_open_tidal(),
				icon: ExternalLink,
				onSelect: openTidal
			},
			{
				id: 'close-player',
				label: m.player_close(),
				icon: X,
				danger: true,
				separator: true,
				onSelect: () => player.close()
			}
		);

		return actions;
	});
</script>

<div class="actions">
	{#if !isNarrow}
		<PlayerVolume />
	{/if}

	<button
		type="button"
		class="a-btn"
		class:on={player.isExpanded && player.panel === 'queue'}
		onclick={() => player.openPanel('queue')}
		title={m.player_queue()}
		aria-label={m.player_queue()}
		aria-expanded={player.isExpanded && player.panel === 'queue'}
	>
		<ListMusic size={15} />
		{#if player.queueCount > 0}<span class="count">{player.queueCount}</span>{/if}
	</button>
	<button
		type="button"
		class="a-btn"
		class:on={player.isExpanded && player.panel === 'lyrics'}
		onclick={() => player.openPanel('lyrics')}
		title={m.player_lyrics()}
		aria-label={m.player_lyrics()}
		aria-expanded={player.isExpanded && player.panel === 'lyrics'}
	>
		<Mic2 size={15} />
	</button>
	<button
		type="button"
		class="a-btn"
		onclick={() => player.toggleExpanded()}
		title={player.isExpanded ? m.player_collapse() : m.player_expand()}
		aria-label={player.isExpanded ? m.player_collapse() : m.player_expand()}
	>
		{#if player.isExpanded}<ChevronDown size={16} />{:else}<ChevronUp size={16} />{/if}
	</button>
	<DropdownMenu
		items={moreActions}
		triggerClass="player-more-actions"
		triggerAriaLabel={m.track_action_menu()}
	>
		{#snippet trigger()}
			<MoreHorizontal size={17} />
		{/snippet}
	</DropdownMenu>
</div>
