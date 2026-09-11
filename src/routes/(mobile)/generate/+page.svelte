<script lang="ts">
	import { enhance } from '$app/forms';
	import { AlertCircle, Sparkles } from '@lucide/svelte';
	import GeneratedSet from '#lib/components/music/GeneratedSet.svelte';
	import MobileScreenHeader from '#lib/components/mobile/MobileScreenHeader.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { ProvisionalSet, ProvisionalTrack } from '#lib/taste/provisional';
	import type { TrackSummary } from '#lib/tidal/models.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let targetCount = $state(20);
	let familiarity = $state(50);
	let seedArtistId = $state('');
	let isGenerating = $state(false);
	let saveSuccess = $state(false);

	const currentSet = $derived<ProvisionalSet | null>(
		form?.success && form.set ? (form.set as ProvisionalSet) : null
	);

	function toTrackSummary(track: ProvisionalTrack): TrackSummary {
		return {
			kind: 'track',
			id: track.id,
			title: track.title,
			artists: track.artists,
			...(track.duration === undefined ? {} : { duration: track.duration }),
			provenance: track.provenance
		};
	}

	async function recordAcceptedSet(): Promise<void> {
		if (!currentSet?.tracks.length) return;
		try {
			await fetch('/api/generation-cooldown', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: currentSet.tracks.map((track) => track.id) })
			});
		} catch {
			// A local review action still succeeds if cooldown persistence is unavailable.
		}
	}

	function playSet(): void {
		if (!currentSet?.tracks.length) return;
		const tracks = currentSet.tracks.map(toTrackSummary);
		player.play(tracks[0]!, tracks);
		void recordAcceptedSet();
	}

	function playTrack(track: ProvisionalTrack): void {
		if (!currentSet) return;
		const tracks = currentSet.tracks.map(toTrackSummary);
		player.play(
			tracks.find((candidate) => candidate.id === track.id) ?? toTrackSummary(track),
			tracks
		);
	}

	function saveSet(): void {
		if (!currentSet?.tracks.length) return;
		const date = new Date().toLocaleDateString();
		customPlaylists.createPlaylist(
			m.taste_saved_title({ date }),
			m.taste_saved_description({ summary: currentSet.summary }),
			currentSet.tracks.map(toTrackSummary)
		);
		saveSuccess = true;
		void recordAcceptedSet();
	}

	function downloadM3U8(): void {
		if (!currentSet) return;
		const rows = currentSet.tracks.flatMap((track) => [
			`#EXTINF:${track.duration ?? -1},${track.artists.map((artist) => artist.name).join(', ')} - ${track.title}`,
			`tidal://track/${track.id}`
		]);
		const url = URL.createObjectURL(
			new Blob([['#EXTM3U', ...rows].join('\n')], { type: 'audio/x-mpegurl' })
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `halflight-set-${Date.now()}.m3u8`;
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

<section class="mobile-generate" aria-labelledby="mobile-generate-title">
	<MobileScreenHeader
		headingId="mobile-generate-title"
		heading={m.mobile_generate_title()}
		lead={m.mobile_generate_description()}
		kicker={m.brand_name()}
	/>

	{#if form?.errorCode}
		<p class="mobile-generate-error" role="alert">
			<AlertCircle size={18} aria-hidden="true" />
			{form.errorCode === 'invalid_generation_input'
				? m.generate_invalid_input()
				: form.errorCode === 'generation_connection_required'
					? m.generate_connection_required()
					: m.generate_unavailable()}
		</p>
	{/if}

	<form
		method="POST"
		action="?/generate"
		use:enhance={() => {
			isGenerating = true;
			return async ({ update }) => {
				await update();
				isGenerating = false;
			};
		}}
		class="mobile-generate-form"
	>
		<label>
			<span>{m.mobile_generate_length()}</span>
			<select name="targetCount" bind:value={targetCount}>
				<option value={15}>{m.mobile_generate_length_15()}</option>
				<option value={20}>{m.mobile_generate_length_20()}</option>
				<option value={30}>{m.mobile_generate_length_30()}</option>
			</select>
		</label>

		<label>
			<span>{m.mobile_generate_familiarity()}</span>
			<input
				name="familiarity"
				type="range"
				min="0"
				max="100"
				step="25"
				bind:value={familiarity}
				aria-valuetext={`${familiarity}% ${m.mobile_generate_familiar()}`}
			/>
			<span class="mobile-generate-range-labels">
				{m.mobile_generate_discovery()} <b>{familiarity}%</b>
				{m.mobile_generate_familiar()}
			</span>
		</label>

		{#if data.seedArtists.length > 0}
			<label>
				<span>{m.mobile_generate_seed()}</span>
				<select name="seedArtistId" bind:value={seedArtistId}>
					<option value="">{m.mobile_generate_profile_seed()}</option>
					{#each data.seedArtists as artist (artist.id)}
						<option value={artist.id}>{artist.name}</option>
					{/each}
				</select>
			</label>
		{/if}

		<Button
			type="submit"
			variant="primary"
			size="md"
			disabled={isGenerating || !data.connection.connected}
		>
			<Sparkles size={17} class={isGenerating ? 'animate-spin' : ''} />
			{isGenerating ? m.mobile_generate_generating() : m.mobile_generate_submit()}
		</Button>
	</form>

	{#if currentSet}
		<div class="mobile-generated-result">
			<GeneratedSet
				set={currentSet}
				{saveSuccess}
				onPlay={playSet}
				onPlayTrack={playTrack}
				onSave={saveSet}
				onExport={downloadM3U8}
			/>
		</div>
	{/if}
</section>

<style>
	.mobile-generate {
		padding: clamp(1.25rem, 5vw, 2rem) clamp(1.25rem, 5vw, 2rem) clamp(2.5rem, 10vw, 4rem);
	}

	.mobile-generate-form {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: var(--shadow-panel);
	}

	.mobile-generate-form label {
		display: grid;
		gap: 0.55rem;
		color: var(--text-secondary);
		font-size: var(--fs-xs);
		font-weight: 650;
	}

	.mobile-generate-form select,
	.mobile-generate-form input[type='range'] {
		width: 100%;
		min-height: 2.75rem;
		accent-color: var(--action);
	}

	.mobile-generate-form select {
		padding: 0 0.75rem;
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		font: inherit;
	}

	.mobile-generate-range-labels {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 500;
	}

	.mobile-generate-range-labels b {
		color: var(--text-primary);
	}

	.mobile-generate-error {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		margin: 0 0 1rem;
		padding: 0.8rem 0.9rem;
		color: var(--text-primary);
		border: 1px solid var(--danger);
		border-radius: var(--radius-md);
		background: var(--danger-subtle);
		font-size: var(--fs-sm);
	}

	.mobile-generated-result {
		container-type: inline-size;
		margin-top: 1.25rem;
	}
</style>
