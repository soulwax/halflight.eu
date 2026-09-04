<script lang="ts">
	import { ListMusic, Mic2, Move, Radio } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';
	import AlbumArtPanel from './AlbumArtPanel.svelte';
	import QueuePanel from './panels/QueuePanel.svelte';
	import LyricsPanel from './panels/LyricsPanel.svelte';
	import SourcePanel from './panels/SourcePanel.svelte';
	import PlayerVolume from './PlayerVolume.svelte';

	let {
		track,
		floating,
		onDragStart
	}: {
		track: TrackSummary;
		floating: boolean;
		onDragStart: (event: PointerEvent) => void;
	} = $props();
</script>

<div class="panel">
	{#if floating}
		<button
			type="button"
			class="drag-handle"
			onpointerdown={onDragStart}
			aria-label={m.player_undock()}
		>
			<Move size={13} />
		</button>
	{/if}

	<div class="panel-inner">
		<AlbumArtPanel {track} />

		<div class="panel-main">
			<div class="mobile-vol">
				<PlayerVolume />
			</div>

			<div class="tabs" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={player.panel === 'queue'}
					class:on={player.panel === 'queue'}
					onclick={() => (player.panel = 'queue')}
				>
					<ListMusic size={13} />
					{m.player_queue()}
					{#if player.queueCount}<span class="tab-count">{player.queueCount}</span>{/if}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={player.panel === 'lyrics'}
					class:on={player.panel === 'lyrics'}
					onclick={() => player.openPanel('lyrics')}
				>
					<Mic2 size={13} />
					{m.player_lyrics()}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={player.panel === 'source'}
					class:on={player.panel === 'source'}
					onclick={() => (player.panel = 'source')}
				>
					<Radio size={13} />
					{m.player_source()}
				</button>
			</div>

			<div class="panel-body">
				{#if player.panel === 'queue'}
					<QueuePanel />
				{:else if player.panel === 'lyrics'}
					<LyricsPanel />
				{:else}
					<SourcePanel {track} />
				{/if}
			</div>
		</div>
	</div>
</div>
