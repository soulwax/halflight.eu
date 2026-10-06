<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { nextLyricText } from '#lib/player/lyrics-follow.js';

	const next = $derived(nextLyricText(player.lyricsCues, player.activeLyricIndex));
</script>

{#if next}
	<p class="lyrics-next-caption"><span class="sr-only">{m.player_lyrics_next()}: </span>{next}</p>
{/if}

<style>
	.lyrics-next-caption {
		position: sticky;
		bottom: 0;
		margin: 0;
		padding: 0.5rem 0.6rem;
		overflow: hidden;
		background: var(--surface-canvas);
		color: var(--text-muted);
		font-size: 0.78rem;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
