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

<section class="max-w-4xl space-y-8" aria-labelledby="generator-title">
	<header class="border-b-2 border-[var(--border-subtle)] pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
			{m.home_generate_eyebrow()}
		</p>
		<h1
			id="generator-title"
			class="mt-1 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl"
		>
			{m.generate_title()}
		</h1>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			{m.generate_description()}
		</p>
	</header>

	{#if form?.errorCode || streamError}
		<div
			class="flex items-center gap-3 border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-sm text-[var(--text-primary)]"
			role="alert"
		>
			<AlertCircle size={18} class="shrink-0 text-[var(--danger)]" />
			<p>
				{form?.errorCode === 'invalid_generation_input'
					? m.generate_invalid_input()
					: form?.errorCode === 'generation_connection_required'
						? m.generate_connection_required()
						: m.generate_unavailable()}
			</p>
		</div>
	{/if}

	<!-- Knobs Configuration Panel -->
	<section
		class="relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6"
		aria-labelledby="knobs-title"
	>
		<div class="absolute top-0 left-0 h-1 w-full bg-[var(--action)]"></div>
		<h2 id="knobs-title" class="flex items-center gap-2 text-lg font-bold tracking-tight">
			<Sliders size={18} class="text-[var(--action)]" />
			{m.generate_shape_title()}
		</h2>

		<form
			method="POST"
			action="?/generate"
			use:enhance={({ formData, cancel }) => {
				cancel();
				void startGeneration(formData);
			}}
			class="mt-6 space-y-6"
		>
			<!-- Familiarity Slider -->
			<div class="space-y-2">
				<div class="flex items-center justify-between text-sm">
					<label for="familiarity-knob" class="font-semibold text-[var(--text-primary)]">
						{m.generate_familiarity()}
					</label>
					<span class="font-mono text-xs text-[var(--accent-gold)]">
						{m.generate_familiarity_readout({
							familiar: familiarity,
							discovery: 100 - familiarity
						})}
					</span>
				</div>
				<input
					id="familiarity-knob"
					name="familiarity"
					type="range"
					min="0"
					max="100"
					step="5"
					bind:value={familiarity}
					class="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-canvas)] accent-[var(--action)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--action)]"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={familiarity}
					aria-valuetext={m.generate_familiarity_readout({
						familiar: familiarity,
						discovery: 100 - familiarity
					})}
				/>
				<div
					class="flex justify-between text-[0.68rem] tracking-wider text-[var(--text-muted)] uppercase"
				>
					<span>{m.generate_scale_discovery()}</span>
					<span>{m.generate_scale_balanced()}</span>
					<span>{m.generate_scale_favourites()}</span>
				</div>
			</div>

			<!-- Set Length, Era, Minimum Length & Seed Selection Grid -->
			<div class="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
				<!-- Track Count -->
				<div class="space-y-1.5">
					<label
						for="track-count-select"
						class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						{m.generate_set_size()}
					</label>
					<select
						id="track-count-select"
						name="targetCount"
						bind:value={targetCount}
						class="w-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:border-[var(--action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
					>
						{#each SIZE_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label()}</option>
						{/each}
					</select>
				</div>

				<!-- Era Window -->
				<div class="space-y-1.5">
					<label
						for="era-select"
						class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						{m.generate_era()}
					</label>
					<select
						id="era-select"
						name="eraCenter"
						bind:value={eraCenter}
						class="w-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:border-[var(--action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
					>
						{#each ERA_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label()}</option>
						{/each}
					</select>
				</div>

				<!-- Minimum Track Length -->
				<div class="space-y-1.5">
					<label
						for="min-length-select"
						class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						{m.generate_min_length()}
					</label>
					<select
						id="min-length-select"
						name="minDurationSeconds"
						bind:value={minDurationSeconds}
						class="w-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:border-[var(--action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
					>
						{#each MIN_LENGTH_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label()}</option>
						{/each}
					</select>
				</div>

				<!-- Seed Anchor Selection -->
				<div class="space-y-1.5">
					<label
						for="seed-artist-select"
						class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						{m.generate_seed()}
					</label>
					<select
						id="seed-artist-select"
						name="seedArtistId"
						bind:value={seedArtistId}
						class="w-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:border-[var(--action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
					>
						<option value="">{m.generate_profile_seed()}</option>
						{#each data.seedArtists as artist (artist.id)}
							<option value={artist.id}>{m.generate_focus_on({ artist: artist.name })}</option>
						{/each}
					</select>
				</div>
			</div>

			<label class="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)]">
				<input
					type="checkbox"
					name="excludeExplicit"
					bind:checked={excludeExplicit}
					class="size-4 accent-[var(--action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
				/>
				{m.generate_exclude_explicit()}
			</label>

			<div class="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-5">
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={isGenerating || !data.connection.connected}
					class="w-full sm:w-auto"
				>
					<Sparkles size={16} class={`mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
					{isGenerating ? m.generate_generating() : m.generate_submit()}
				</Button>
				{#if isGenerating}
					<Button
						type="button"
						variant="secondary"
						size="md"
						onclick={cancelGeneration}
						class="w-full sm:w-auto"
					>
						{m.playlist_cancel()}
					</Button>
				{/if}

				{#if !data.connection.connected}
					<span class="w-full text-xs text-[var(--danger)] sm:w-auto">
						{m.generate_connection_required()}
					</span>
				{/if}
			</div>
			{#if isGenerating && progressLabel}
				<p class="text-sm text-[var(--text-muted)]" role="status" aria-live="polite">
					{progressLabel}
				</p>
			{/if}
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
