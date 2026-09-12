<script lang="ts">
	import { enhance } from '$app/forms';
	import { AlertCircle, Sliders, Sparkles } from '@lucide/svelte';

	import GeneratedSet from '#lib/components/music/GeneratedSet.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { player } from '#lib/player/player.svelte.js';
	import type { GenerationStreamStage } from '#lib/taste/generation-progress.js';
	import { readGenerationStream } from '#lib/taste/generation-stream.js';
	import type { ProvisionalSet, ProvisionalTrack } from '#lib/taste/provisional';
	import type { TrackSummary } from '#lib/tidal/models';
	import ViewHeader from '#lib/components/ui/ViewHeader.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let familiarity = $state(50);
	let targetCount = $state(20);
	let seedArtistId = $state('');
	let eraCenter = $state('');
	let minDurationSeconds = $state('');
	let excludeExplicit = $state(false);
	let isGenerating = $state(false);
	let saveSuccess = $state(false);
	let generatedSet = $state<ProvisionalSet | null>(null);
	let progressStage = $state<GenerationStreamStage | null>(null);
	let streamError = $state(false);
	let generationRun = 0;
	let generationAbort: AbortController | null = null;

	// Mid-decade centre years for the era-window request-fit term; '' is unconstrained.
	const ERA_OPTIONS = [
		{ value: '', label: m.generate_era_any },
		{ value: '1975', label: m.generate_era_1970s },
		{ value: '1985', label: m.generate_era_1980s },
		{ value: '1995', label: m.generate_era_1990s },
		{ value: '2005', label: m.generate_era_2000s },
		{ value: '2015', label: m.generate_era_2010s },
		{ value: '2025', label: m.generate_era_2020s }
	];

	// Drop interludes and skits shorter than the chosen floor; '' keeps every length.
	const MIN_LENGTH_OPTIONS = [
		{ value: '', label: m.generate_min_length_any },
		{ value: '60', label: m.generate_min_length_60 },
		{ value: '90', label: m.generate_min_length_90 },
		{ value: '120', label: m.generate_min_length_120 }
	];

	const SIZE_OPTIONS = [
		{ value: 15, label: m.generate_size_15 },
		{ value: 20, label: m.generate_size_20 },
		{ value: 25, label: m.generate_size_25 },
		{ value: 30, label: m.generate_size_30 },
		{ value: 40, label: m.generate_size_40 },
		{ value: 50, label: m.generate_size_50 }
	];

	$effect(() => {
		if (data.profile.knobDefaults.familiarity !== undefined) {
			familiarity = data.profile.knobDefaults.familiarity;
		}
	});

	const currentSet = $derived<ProvisionalSet | null>(
		generatedSet ?? (form?.success && form?.set ? (form.set as ProvisionalSet) : null)
	);
	const progressLabel = $derived(
		progressStage === 'expanding'
			? m.generation_progress_expanding()
			: progressStage === 'scoring'
				? m.generation_progress_scoring()
				: progressStage === 'sequencing'
					? m.generation_progress_sequencing()
					: ''
	);

	async function startGeneration(formData: FormData): Promise<void> {
		generationAbort?.abort();
		const run = ++generationRun;
		const abort = new AbortController();
		generationAbort = abort;
		isGenerating = true;
		streamError = false;
		saveSuccess = false;
		progressStage = 'expanding';

		try {
			const response = await fetch('/api/taste/generate', {
				method: 'POST',
				body: formData,
				signal: abort.signal
			});
			if (!response.ok || !response.body) {
				if (run === generationRun) streamError = true;
				return;
			}

			for await (const message of readGenerationStream(response)) {
				if (run !== generationRun) continue;
				if (message.type === 'progress') progressStage = message.stage;
				else if (message.type === 'complete') generatedSet = message.set;
				else streamError = true;
			}
		} catch (cause) {
			if (
				run === generationRun &&
				!(cause instanceof DOMException && cause.name === 'AbortError')
			) {
				streamError = true;
			}
		} finally {
			if (run === generationRun) {
				isGenerating = false;
				progressStage = null;
				generationAbort = null;
			}
		}
	}

	function cancelGeneration(): void {
		generationAbort?.abort();
	}

	function toTrackSummary(t: ProvisionalTrack): TrackSummary {
		return {
			kind: 'track',
			id: t.id,
			title: t.title,
			artists: t.artists,
			duration: t.duration,
			provenance: t.provenance
		};
	}

	async function recordAcceptedSet(): Promise<void> {
		if (!currentSet || currentSet.tracks.length === 0) return;
		try {
			await fetch('/api/generation-cooldown', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ trackIds: currentSet.tracks.map((track) => track.id) })
			});
		} catch {
			// Accepting a set must not delay local playback or saving it.
		}
	}

	function playWholeSet() {
		if (!currentSet || currentSet.tracks.length === 0) return;
		const summaries = currentSet.tracks.map(toTrackSummary);
		player.play(summaries[0], summaries);
		void recordAcceptedSet();
	}

	function playSingleTrack(t: ProvisionalTrack) {
		if (!currentSet) return;
		const summaries = currentSet.tracks.map(toTrackSummary);
		const target = summaries.find((s) => s.id === t.id) ?? toTrackSummary(t);
		player.play(target, summaries);
	}

	function saveToPlaylists() {
		if (!currentSet || currentSet.tracks.length === 0) return;
		const summaries = currentSet.tracks.map(toTrackSummary);
		const now = new Date();
		const title = m.taste_saved_title({ date: now.toLocaleDateString() });
		const desc = m.taste_saved_description({ summary: currentSet.summary });

		customPlaylists.createPlaylist(title, desc, summaries);
		saveSuccess = true;
		void recordAcceptedSet();
		setTimeout(() => {
			saveSuccess = false;
		}, 3500);
	}

	function downloadM3U8() {
		if (!currentSet) return;
		const lines = ['#EXTM3U'];
		for (const t of currentSet.tracks) {
			const artists = t.artists.map((a) => a.name).join(', ');
			lines.push(`#EXTINF:${t.duration ?? -1},${artists} - ${t.title}`);
			lines.push(`tidal://track/${t.id}`);
		}
		const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `halflight-set-${Date.now()}.m3u8`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>{m.generate_title()} — {m.brand_name()}</title>
</svelte:head>

<section class="generator-page" aria-labelledby="generator-title">
	<ViewHeader
		eyebrow={m.home_generate_eyebrow()}
		title={m.generate_title()}
		titleId="generator-title"
		description={m.generate_description()}
	>
		{#snippet mark()}<Sparkles size={22} />{/snippet}
	</ViewHeader>

	{#if form?.errorCode || streamError}
		<div class="generator-notice" role="alert">
			<AlertCircle size={18} aria-hidden="true" />
			<p>
				{form?.errorCode === 'invalid_generation_input'
					? m.generate_invalid_input()
					: form?.errorCode === 'generation_connection_required'
						? m.generate_connection_required()
						: m.generate_unavailable()}
			</p>
		</div>
	{/if}

	<section class="generator-builder" aria-labelledby="knobs-title">
		<header class="generator-builder-heading">
			<div class="generator-builder-icon" aria-hidden="true"><Sliders size={20} /></div>
			<div>
				<h2 id="knobs-title">{m.generate_shape_title()}</h2>
				<p>{m.generate_description()}</p>
			</div>
		</header>

		<form
			method="POST"
			action="?/generate"
			use:enhance={({ formData, cancel }) => {
				cancel();
				void startGeneration(formData);
			}}
			class="generator-builder-form"
		>
			<div class="generator-familiarity">
				<div class="generator-familiarity-heading">
					<label for="familiarity-knob">
						{m.generate_familiarity()}
					</label>
					<output for="familiarity-knob">
						{m.generate_familiarity_readout({
							familiar: familiarity,
							discovery: 100 - familiarity
						})}
					</output>
				</div>
				<input
					id="familiarity-knob"
					name="familiarity"
					type="range"
					min="0"
					max="100"
					step="5"
					bind:value={familiarity}
					class="generator-range"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={familiarity}
					aria-valuetext={m.generate_familiarity_readout({
						familiar: familiarity,
						discovery: 100 - familiarity
					})}
				/>
				<div class="generator-familiarity-scale" aria-hidden="true">
					<span>{m.generate_scale_discovery()}</span>
					<span>{m.generate_scale_balanced()}</span>
					<span>{m.generate_scale_favourites()}</span>
				</div>
			</div>

			<div class="generator-fields">
				<div class="generator-field">
					<label for="track-count-select">
						{m.generate_set_size()}
					</label>
					<select
						id="track-count-select"
						name="targetCount"
						bind:value={targetCount}
						class="generator-select"
					>
						{#each SIZE_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label()}</option>
						{/each}
					</select>
				</div>

				<div class="generator-field">
					<label for="era-select">
						{m.generate_era()}
					</label>
					<select id="era-select" name="eraCenter" bind:value={eraCenter} class="generator-select">
						{#each ERA_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label()}</option>
						{/each}
					</select>
				</div>

				<div class="generator-field">
					<label for="min-length-select">
						{m.generate_min_length()}
					</label>
					<select
						id="min-length-select"
						name="minDurationSeconds"
						bind:value={minDurationSeconds}
						class="generator-select"
					>
						{#each MIN_LENGTH_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label()}</option>
						{/each}
					</select>
				</div>

				<div class="generator-field">
					<label for="seed-artist-select">
						{m.generate_seed()}
					</label>
					<select
						id="seed-artist-select"
						name="seedArtistId"
						bind:value={seedArtistId}
						class="generator-select"
					>
						<option value="">{m.generate_profile_seed()}</option>
						{#each data.seedArtists as artist (artist.id)}
							<option value={artist.id}>{m.generate_focus_on({ artist: artist.name })}</option>
						{/each}
					</select>
				</div>
			</div>

			<label class="generator-toggle">
				<input
					type="checkbox"
					name="excludeExplicit"
					bind:checked={excludeExplicit}
					class="generator-toggle-control"
				/>
				{m.generate_exclude_explicit()}
			</label>

			<footer class="generator-actions">
				<div class="generator-action-buttons">
					<Button
						type="submit"
						variant="primary"
						size="md"
						disabled={isGenerating || !data.connection.connected}
					>
						<Sparkles size={16} aria-hidden="true" class={isGenerating ? 'animate-spin' : ''} />
						{isGenerating ? m.generate_generating() : m.generate_submit()}
					</Button>
					{#if isGenerating}
						<Button type="button" variant="secondary" size="md" onclick={cancelGeneration}>
							{m.playlist_cancel()}
						</Button>
					{/if}
				</div>

				{#if !data.connection.connected}
					<p class="generator-connection-note">
						{m.generate_connection_required()}
					</p>
				{:else if isGenerating && progressLabel}
					<p class="generator-progress" role="status" aria-live="polite">{progressLabel}</p>
				{/if}
			</footer>
		</form>
	</section>

	<!-- Provisional Generated Set Section -->
	{#if currentSet}
		<GeneratedSet
			set={currentSet}
			{saveSuccess}
			onPlay={playWholeSet}
			onPlayTrack={playSingleTrack}
			onSave={saveToPlaylists}
			onExport={downloadM3U8}
		/>
	{/if}
</section>

<style>
	.generator-page {
		display: grid;
		gap: var(--space-section);
		max-width: 70rem;
	}

	.generator-builder-heading {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.generator-builder-icon {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		border-radius: var(--radius-md);
		background: var(--surface-selected);
		color: var(--action);
	}

	.generator-builder-icon {
		width: 2.5rem;
		height: 2.5rem;
	}

	.generator-builder h2 {
		margin: 0;
		color: var(--text-primary);
	}

	.generator-builder-heading p {
		max-width: 42rem;
		margin: 0.45rem 0 0;
		color: var(--text-secondary);
	}

	.generator-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem 1.1rem;
		border: 1px solid color-mix(in oklab, var(--danger) 35%, var(--border-subtle));
		border-radius: var(--radius-md);
		background: var(--danger-subtle);
		color: var(--text-primary);
	}

	.generator-notice svg {
		flex: 0 0 auto;
		margin-top: 0.15rem;
		color: var(--danger);
	}

	.generator-notice p,
	.generator-connection-note,
	.generator-progress {
		margin: 0;
	}

	.generator-builder {
		display: grid;
		gap: clamp(1.25rem, 2.5vw, 1.75rem);
		padding: var(--space-panel);
		border: var(--module-border);
		border-radius: var(--module-radius);
		background: var(--module-bg);
		box-shadow: var(--module-shadow);
	}

	.generator-builder-form {
		display: grid;
		gap: clamp(1.25rem, 2.5vw, 1.75rem);
	}

	.generator-familiarity {
		padding: 1rem 1.1rem 0.8rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: color-mix(in oklab, var(--surface-selected) 30%, var(--surface-raised));
	}

	.generator-familiarity-heading,
	.generator-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.generator-familiarity-heading label {
		color: var(--text-primary);
		font-weight: 650;
	}

	.generator-familiarity-heading output {
		color: var(--text-secondary);
		font-size: var(--fs-sm);
	}

	.generator-range {
		width: 100%;
		margin: 1rem 0 0.4rem;
		accent-color: var(--action);
	}

	.generator-familiarity-scale {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		color: var(--text-muted);
		font-size: var(--fs-2xs);
	}

	.generator-familiarity-scale span:nth-child(2) {
		text-align: center;
	}

	.generator-familiarity-scale span:last-child {
		text-align: right;
	}

	.generator-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.generator-field {
		display: grid;
		gap: 0.45rem;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		font-weight: 600;
	}

	.generator-select {
		min-height: 2.7rem;
		padding: 0 0.8rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		color: var(--text-primary);
		font: inherit;
		font-weight: 500;
	}

	.generator-select:hover {
		border-color: color-mix(in oklab, var(--action) 45%, var(--border-strong));
	}

	.generator-select:focus-visible,
	.generator-range:focus-visible,
	.generator-toggle-control:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.generator-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: max-content;
		min-height: 2.75rem;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	.generator-toggle-control {
		width: 1rem;
		height: 1rem;
		accent-color: var(--action);
	}

	.generator-actions {
		padding-top: 1.25rem;
		border-top: 1px solid var(--border-subtle);
	}

	.generator-action-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.generator-connection-note,
	.generator-progress {
		max-width: 24rem;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		text-align: right;
	}

	.generator-connection-note {
		color: var(--danger);
	}

	@media (max-width: 42rem) {
		.generator-fields {
			grid-template-columns: 1fr;
		}

		.generator-familiarity-heading,
		.generator-actions {
			align-items: flex-start;
			flex-direction: column;
		}

		.generator-connection-note,
		.generator-progress {
			text-align: left;
		}
	}
</style>
