<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft, Loader2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';

	const track = $derived(player.currentTrack);
</script>

<section class="mobile-lyrics" aria-labelledby="mobile-lyrics-title">
	<header>
		<a href={resolve('/(mobile)/now')} aria-label={m.now_lyrics_back()}>
			<ChevronLeft size={20} aria-hidden="true" />
		</a>
		<div>
			<h1 id="mobile-lyrics-title">{m.player_lyrics()}</h1>
			{#if track}<p>{track.title}</p>{/if}
		</div>
	</header>

	{#if !track}
		<p class="empty">{m.now_idle_message()}</p>
	{:else if player.isLyricsLoading}
		<p class="empty" role="status">
			<Loader2 size={20} class="animate-spin" />{m.now_lyrics_loading()}
		</p>
	{:else if player.lyricsCues.length}
		<div class="cues">
			{#each player.lyricsCues as cue, index (`${cue.time}-${index}`)}
				<button
					type="button"
					class:active={player.activeLyricIndex === index}
					onclick={() => player.seek(cue.time)}
				>
					<span>{formatClock(cue.time)}</span>{cue.text || '♪'}
				</button>
			{/each}
		</div>
	{:else if player.lyrics}
		<div class="plain">
			{#each player.lyrics.split('\n') as line, index (index)}<p>{line || ' '}</p>{/each}
		</div>
	{:else}
		<p class="empty">{m.player_no_lyrics()}</p>
	{/if}
</section>

<style>
	.mobile-lyrics {
		min-height: 100%;
		padding: 1rem 1.25rem 2rem;
	}
	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	header a {
		display: grid;
		width: 3rem;
		height: 3rem;
		place-items: center;
		color: var(--text-primary);
	}
	h1,
	p {
		margin: 0;
	}
	h1 {
		font-size: 1.25rem;
	}
	header p {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.cues {
		display: grid;
		gap: 0.3rem;
	}
	.cues button {
		display: flex;
		width: 100%;
		min-height: 3rem;
		align-items: baseline;
		gap: 0.75rem;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		padding: 0.65rem 0.25rem;
		text-align: left;
		font: inherit;
	}
	.cues button span {
		color: var(--text-muted);
		font:
			0.75rem ui-monospace,
			monospace;
	}
	.cues button.active {
		color: var(--action);
		font-weight: 600;
	}
	.cues button:focus-visible,
	header a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}
	.plain {
		display: grid;
		gap: 0.9rem;
		line-height: 1.6;
	}
	.empty {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.6rem;
		min-height: 12rem;
		color: var(--text-muted);
		text-align: center;
	}
</style>
