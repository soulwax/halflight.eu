<script lang="ts">
	import { Radio } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let {
		track,
		class: className = ''
	}: {
		track: TrackSummary;
		class?: string;
	} = $props();

	let isStarting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function startRadio() {
		if (isStarting) return;
		isStarting = true;
		errorMessage = null;

		try {
			const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/radio`);
			if (!response.ok) throw new Error('Radio unavailable');
			const result = (await response.json()) as { tracks?: TrackSummary[] };
			const radioTracks = result.tracks ?? [];
			if (!radioTracks.length) throw new Error('Radio empty');

			player.play(radioTracks[0], radioTracks, m.player_radio_provenance({ title: track.title }));
		} catch {
			errorMessage = m.player_radio_unavailable();
		} finally {
			isStarting = false;
		}
	}
</script>

<button
	type="button"
	class={className}
	onclick={startRadio}
	disabled={isStarting}
	title={m.player_start_radio()}
	aria-label={m.player_start_radio()}
	aria-busy={isStarting}
>
	<Radio size={15} />
</button>
<span class="sr-only" aria-live="polite">
	{#if isStarting}{m.player_starting_radio()}{:else if errorMessage}{errorMessage}{/if}
</span>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
