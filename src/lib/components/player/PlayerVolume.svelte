<script lang="ts">
	import { Volume1, Volume2, VolumeX } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';

	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	const isMuted = $derived(player.isMuted || player.volume === 0);
	const displayVolume = $derived(isMuted ? 0 : player.volume);
	const maxVolume = $derived(player.maxVolume);

	// Calculate track fill percentages
	const totalPercent = $derived(Math.min(100, Math.max(0, (displayVolume / maxVolume) * 100)));
	const normalPercent = $derived(
		player.isHeadroomEnabled ? Math.min((1 / 1.25) * 100, totalPercent) : totalPercent
	);
	const headroomPercent = $derived(
		player.isHeadroomEnabled && displayVolume > 1
			? Math.min(100, totalPercent) - (1 / 1.25) * 100
			: 0
	);

	function onRangeInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		player.setVolume(parseFloat(target.value));
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		const delta = event.deltaY < 0 ? 0.02 : -0.02;
		player.setVolume(player.volume + delta);
	}

	function onDoubleClick() {
		player.setVolume(1);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'm' || event.key === 'M') {
			event.preventDefault();
			player.toggleMute();
		} else if (event.key === 'Home') {
			event.preventDefault();
			player.setVolume(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			player.setVolume(maxVolume);
		}
	}
</script>

<div
	class="vol"
	class:compact
	class:has-headroom={player.isHeadroomEnabled}
	class:in-headroom={!isMuted && player.volume > 1}
	onwheel={onWheel}
	ondblclick={onDoubleClick}
	title={m.player_volume_reset()}
>
	<button
		type="button"
		class="a-btn vol-mute-btn"
		onclick={() => player.toggleMute()}
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

	<div class="vol-track-wrap">
		<input
			type="range"
			class="vol-slider"
			min="0"
			max={maxVolume}
			step="0.01"
			value={displayVolume}
			oninput={onRangeInput}
			onkeydown={onKeydown}
			aria-label={m.player_volume()}
			aria-valuemin={0}
			aria-valuemax={Math.round(maxVolume * 100)}
			aria-valuenow={Math.round(displayVolume * 100)}
			aria-valuetext={isMuted ? m.player_mute() : `${Math.round(player.volume * 100)}%`}
		/>

		<div class="vol-track-visual" aria-hidden="true">
			<div class="vol-fill-normal" style="width: {normalPercent}%"></div>
			{#if player.isHeadroomEnabled}
				<div class="vol-notch-100" style="left: 80%"></div>
				{#if headroomPercent > 0}
					<div class="vol-fill-headroom" style="left: 80%; width: {headroomPercent}%"></div>
				{/if}
			{/if}
		</div>
	</div>

	<span class="vol-readout" aria-hidden="true">
		{isMuted ? '0%' : `${Math.round(player.volume * 100)}%`}
	</span>

	<button
		type="button"
		class="vol-headroom-toggle"
		class:active={player.isHeadroomEnabled}
		class:boosted={!isMuted && player.volume > 1}
		onclick={() => player.toggleHeadroom()}
		aria-pressed={player.isHeadroomEnabled}
		aria-label={player.isHeadroomEnabled ? m.player_headroom_disable() : m.player_headroom_enable()}
		title={player.isHeadroomEnabled ? m.player_headroom_disable() : m.player_headroom_enable()}
	>
		{m.player_headroom_toggle()}
	</button>
</div>
