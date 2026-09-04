<script lang="ts">
	import {
		ChevronDown,
		ChevronUp,
		ExternalLink,
		ListMusic,
		Mic2,
		PictureInPicture2,
		Plus,
		X
	} from '@lucide/svelte';
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
</script>

<div class="actions">
	{#if !isNarrow}
		<PlayerVolume />
	{/if}

	<button
		type="button"
		class="a-btn"
		onclick={() => customPlaylists.promptAddToPlaylist(track)}
		title={m.player_add_to_playlist()}
		aria-label={m.player_add_to_playlist()}
	>
		<Plus size={15} />
	</button>
	<button
		type="button"
		class="a-btn"
		class:on={player.isExpanded && player.panel === 'queue'}
		onclick={() => player.openPanel('queue')}
		title={m.player_queue()}
		aria-label={m.player_queue()}
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
	>
		<Mic2 size={15} />
	</button>
	{#if !isNarrow}
		<button
			type="button"
			class="a-btn"
			onclick={() => player.toggleDock()}
			title={floating ? m.player_dock() : m.player_undock()}
			aria-label={floating ? m.player_dock() : m.player_undock()}
		>
			<PictureInPicture2 size={15} />
		</button>
	{/if}
	<a
		class="a-btn"
		href={tidalUrl}
		target="_blank"
		rel="noreferrer"
		title={m.player_open_tidal()}
		aria-label={m.player_open_tidal()}
	>
		<ExternalLink size={13} />
	</a>
	<button
		type="button"
		class="a-btn"
		onclick={() => player.toggleExpanded()}
		title={player.isExpanded ? m.player_collapse() : m.player_expand()}
		aria-label={player.isExpanded ? m.player_collapse() : m.player_expand()}
	>
		{#if player.isExpanded}<ChevronDown size={16} />{:else}<ChevronUp size={16} />{/if}
	</button>
	<button
		type="button"
		class="a-btn"
		onclick={() => player.close()}
		title={m.player_close()}
		aria-label={m.player_close()}
	>
		<X size={15} />
	</button>
</div>
