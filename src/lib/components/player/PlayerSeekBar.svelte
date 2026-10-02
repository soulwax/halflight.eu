<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	let { mobile = false }: { mobile?: boolean } = $props();
	let scrubTrackId: string | null = null;
	const knownDuration = $derived(Number.isFinite(player.duration) && player.duration > 0);
	const trackId = $derived(player.currentTrack?.id);
	$effect(() => {
		void trackId;
		scrubTrackId = null;
		player.cancelScrub();
	});
	function preview(event: Event) {
		if (!player.canSeek) return;
		scrubTrackId = player.currentTrack?.id ?? null;
		player.scrubTo(Number((event.currentTarget as HTMLInputElement).value));
	}
	function commit() {
		if (!player.canSeek || scrubTrackId !== player.currentTrack?.id) {
			player.cancelScrub();
			return;
		}
		player.commitScrub();
		scrubTrackId = null;
	}

	const fillPercent = $derived(
		knownDuration ? Math.max(0, Math.min(100, (player.displayTime / player.duration) * 100)) : 0
	);
	const bufferPercent = $derived(player.bufferedPercent);
</script>

<div class="seek" class:mobile>
	<span class="time">{formatClock(player.displayTime)}</span>
	<div class="seek-track">
		<input
			type="range"
			min="0"
			max={knownDuration ? player.duration : 0}
			step="1"
			value={knownDuration ? player.displayTime : 0}
			disabled={!player.canSeek}
			oninput={preview}
			onchange={commit}
			onpointercancel={() => player.cancelScrub()}
			aria-valuetext={knownDuration
				? m.player_seek_time({
						elapsed: formatClock(player.displayTime),
						total: formatClock(player.duration)
					})
				: m.player_seek_unavailable()}
			aria-label={m.player_seek()}
		/>
		{#if bufferPercent > 0}
			<span class="seek-buffer" style="width:{bufferPercent}%"></span>
		{/if}
		<span class="seek-fill" style="width:{fillPercent}%"></span>
	</div>
	<span class="time"
		>{knownDuration
			? `${mobile ? '−' : ''}${formatClock(mobile ? Math.max(0, player.duration - player.displayTime) : player.duration)}`
			: '—'}</span
	>
</div>

<style>
	.mobile {
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		align-items: center;
		gap: 0;
	}
	.mobile .seek-track {
		position: relative;
		grid-column: 1 / -1;
		grid-row: 1;
		height: 48px;
		width: 100%;
	}
	.mobile input {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 48px;
		margin: 0;
		accent-color: var(--action);
		cursor: pointer;
	}
	.mobile input:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.mobile .time {
		color: var(--text-secondary);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}
	.mobile .time:last-child {
		text-align: right;
	}
	.mobile .seek-fill,
	.mobile .seek-buffer {
		display: none;
	}
</style>
