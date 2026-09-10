<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';

	const fillPercent = $derived(
		player.duration > 0 ? (player.displayTime / player.duration) * 100 : 0
	);
	const bufferPercent = $derived(player.bufferedPercent);
</script>

<div class="seek">
	<span class="time">{formatClock(player.displayTime)}</span>
	<div class="seek-track">
		<input
			type="range"
			min="0"
			max={player.duration || 100}
			step="0.5"
			value={player.displayTime}
			oninput={(e) => player.scrubTo(parseFloat(e.currentTarget.value))}
			onchange={() => player.commitScrub()}
			onpointercancel={() => player.cancelScrub()}
			aria-valuetext={formatClock(player.displayTime)}
			aria-label={m.player_seek()}
		/>
		{#if bufferPercent > 0}
			<span class="seek-buffer" style="width:{bufferPercent}%"></span>
		{/if}
		<span class="seek-fill" style="width:{fillPercent}%"></span>
	</div>
	<span class="time">{formatClock(player.duration)}</span>
</div>
