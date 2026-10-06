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

<div class="seek" class:mobile class:scrubbing={player.scrubPosition !== null}>
	<span class="time">{formatClock(player.displayTime)}</span>
	<div class="seek-track" style:--seek-p={fillPercent}>
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
		--rail: 4px;
		--thumb: 12px;
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		align-items: center;
		gap: 0;
	}
	.mobile.scrubbing,
	.mobile:has(input:active) {
		--rail: 7px;
		--thumb: 18px;
	}
	.mobile .seek-track {
		position: relative;
		grid-column: 1 / -1;
		grid-row: 1;
		height: 44px;
		width: 100%;
	}
	/* Rail */
	.mobile .seek-track::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		top: 50%;
		height: var(--rail);
		transform: translateY(-50%);
		border-radius: var(--radius-full);
		background: color-mix(in oklab, var(--text-primary) 16%, transparent);
		transition: height var(--dur-med) var(--ease-out);
	}
	.mobile .seek-buffer,
	.mobile .seek-fill {
		position: absolute;
		left: 0;
		top: 50%;
		height: var(--rail);
		transform: translateY(-50%);
		border-radius: var(--radius-full);
		pointer-events: none;
		transition: height var(--dur-med) var(--ease-out);
	}
	.mobile .seek-buffer {
		background: color-mix(in oklab, var(--text-primary) 14%, transparent);
	}
	.mobile .seek-fill {
		/* Track the native thumb centre, which travels (100% - thumb) not 100%. */
		width: calc(var(--seek-p, 0) * (100% - var(--thumb)) / 100 + var(--thumb) / 2) !important;
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--text-primary) 82%, transparent),
			var(--text-primary)
		);
	}
	.mobile input {
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		z-index: 1;
		width: 100%;
		height: 44px;
		margin: 0;
		background: transparent;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	.mobile input::-webkit-slider-runnable-track {
		height: 44px;
		background: transparent;
	}
	.mobile input::-moz-range-track {
		height: 44px;
		background: transparent;
	}
	.mobile input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: var(--thumb);
		height: var(--thumb);
		margin-top: calc((44px - var(--thumb)) / 2);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--text-primary);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
		transition:
			width var(--dur-med) var(--ease-out),
			height var(--dur-med) var(--ease-out),
			margin-top var(--dur-med) var(--ease-out);
	}
	.mobile input::-moz-range-thumb {
		width: var(--thumb);
		height: var(--thumb);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--text-primary);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
	}
	.mobile input:focus-visible {
		outline: none;
	}
	.mobile .seek-track:has(input:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
	.mobile input:disabled {
		cursor: default;
	}
	.mobile:has(input:disabled) .seek-track {
		opacity: 0.45;
	}
	.mobile:has(input:disabled) input::-webkit-slider-thumb {
		opacity: 0;
	}
	.mobile:has(input:disabled) input::-moz-range-thumb {
		opacity: 0;
	}
	.mobile .time {
		margin-top: -0.55rem;
		color: var(--text-muted);
		font-size: 0.6875rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		transition: color var(--dur-med) ease;
	}
	.mobile.scrubbing .time {
		color: var(--text-primary);
	}
	.mobile .time:last-child {
		text-align: right;
	}
</style>
