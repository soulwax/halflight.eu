<script lang="ts">
	import { Volume1, Volume2, VolumeX } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { haptics } from '#lib/player/haptics.js';

	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	const isMuted = $derived(player.isMuted || player.volume === 0);
	const displayVolume = $derived(isMuted ? 0 : player.volume);
	const maxVolume = $derived(player.maxVolume);

	// VLC-like continuous track metrics (0..1.25 where 1.0 sits at 80% track width)
	const normalFillPercent = $derived((Math.min(1.0, displayVolume) / maxVolume) * 100);
	const headroomFillPercent = $derived(
		displayVolume > 1.0 ? ((displayVolume - 1.0) / maxVolume) * 100 : 0
	);
	const notchPercent = $derived((1.0 / maxVolume) * 100);

	let prevVolume = player.volume;

	function onRangeInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		let val = parseFloat(target.value);
		if (Number.isNaN(val)) return;

		// Magnetic snap to 100% (1.0) when dragging near reference notch
		if (Math.abs(val - 1.0) <= 0.015 && Math.abs(prevVolume - 1.0) > 0.015) {
			val = 1.0;
			target.value = '1.0';
			haptics.snap();
		} else if ((prevVolume < 1.0 && val >= 1.0) || (prevVolume > 1.0 && val <= 1.0)) {
			haptics.notch();
		} else if (val === 0 || val === maxVolume) {
			haptics.limit();
		}

		prevVolume = val;
		player.setVolume(val);
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		const delta = event.deltaY < 0 ? 0.02 : -0.02;
		let targetVol = Math.max(0, Math.min(maxVolume, player.volume + delta));

		// Snap to 1.0 if passing within snap threshold
		if (Math.abs(targetVol - 1.0) < 0.015) {
			targetVol = 1.0;
			haptics.snap();
		} else if (
			(player.volume < 1.0 && targetVol >= 1.0) ||
			(player.volume > 1.0 && targetVol <= 1.0)
		) {
			haptics.notch();
		} else if (targetVol === 0 || targetVol === maxVolume) {
			haptics.limit();
		} else {
			haptics.tick();
		}

		player.setVolume(targetVol);
		prevVolume = targetVol;
	}

	function onResetVolume() {
		player.setVolume(1.0);
		prevVolume = 1.0;
		haptics.snap();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'm' || event.key === 'M') {
			event.preventDefault();
			player.toggleMute();
			haptics.tick();
		} else if (event.key === '0') {
			event.preventDefault();
			player.setVolume(0);
			haptics.limit();
		} else if (event.key === '1') {
			event.preventDefault();
			onResetVolume();
		} else if (event.key === 'Home') {
			event.preventDefault();
			player.setVolume(0);
			haptics.limit();
		} else if (event.key === 'End') {
			event.preventDefault();
			player.setVolume(maxVolume);
			haptics.limit();
		}
	}
</script>

<div
	class="vol"
	class:compact
	class:has-headroom={maxVolume > 1}
	class:in-headroom={!isMuted && player.volume > 1}
>
	<button
		type="button"
		class="a-btn vol-mute-btn"
		onclick={() => {
			player.toggleMute();
			haptics.tick();
		}}
		aria-label={isMuted ? m.player_unmute() : m.player_mute()}
		title={isMuted ? m.player_unmute() : m.player_mute()}
	>
		{#if isMuted}
			<VolumeX size={15} />
		{:else if player.volume < 0.5}
			<Volume1 size={15} />
		{:else}
			<Volume2 size={15} />
		{/if}
	</button>

	<div class="vol-track" onwheel={onWheel}>
		<input
			type="range"
			class="vol-range"
			min="0"
			max={maxVolume}
			step="0.01"
			value={displayVolume}
			oninput={onRangeInput}
			onkeydown={onKeydown}
			ondblclick={onResetVolume}
			aria-label={m.player_volume()}
			aria-valuemin={0}
			aria-valuemax={Math.round(maxVolume * 100)}
			aria-valuenow={Math.round(displayVolume * 100)}
			aria-valuetext={isMuted ? m.player_mute() : `${Math.round(player.volume * 100)}%`}
		/>

		<span class="vol-fill-normal" style="width: {normalFillPercent}%"></span>
		{#if maxVolume > 1}
			<span class="vol-notch-100" style="left: {notchPercent}%"></span>
			{#if headroomFillPercent > 0}
				<span class="vol-fill-headroom" style="left: {notchPercent}%; width: {headroomFillPercent}%"
				></span>
			{/if}
		{/if}
	</div>

	<button
		type="button"
		class="vol-readout"
		onclick={onResetVolume}
		aria-label={m.player_volume_reset()}
		title={m.player_volume_reset()}
	>
		{isMuted ? '0%' : `${Math.round(player.volume * 100)}%`}
	</button>
</div>
