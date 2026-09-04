<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
</script>

{#if player.isLyricsLoading}
	<div class="lyr-status"><Loader2 size={20} class="animate-spin" /></div>
{:else if player.lyricsCues.length}
	<div class="lyr-cues">
		{#each player.lyricsCues as cue, i (cue.time + '-' + i)}
			<button
				type="button"
				class="lyr-line"
				class:active={player.activeLyricIndex === i}
				onclick={() => player.seek(cue.time)}
			>
				{cue.text || '♪'}
			</button>
		{/each}
	</div>
{:else if player.lyrics}
	<div class="lyr-plain">
		{#each player.lyrics.split('\n') as line, i (i)}<p>{line || ' '}</p>{/each}
	</div>
{:else}
	<p class="empty">{m.player_no_lyrics()}</p>
{/if}
