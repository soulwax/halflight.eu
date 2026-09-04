<script lang="ts">
	import { enhance } from '$app/forms';
	import { AlertCircle, Check, Download, ListMusic, Play, Sliders, Sparkles } from '@lucide/svelte';

	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import type { TrackSummary } from '#lib/tidal/models';
	import type { ActionData, PageData } from './$types';
	import type { ProvisionalSet, ProvisionalTrack } from '#lib/server/taste/generate';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let familiarity = $state(50);
	let targetCount = $state(20);
	let seedArtistId = $state('');
	let isGenerating = $state(false);
	let saveSuccess = $state(false);

	$effect(() => {
		if (data.profile.knobDefaults.familiarity !== undefined) {
			familiarity = data.profile.knobDefaults.familiarity;
		}
	});

	const currentSet = $derived<ProvisionalSet | null>(
		form?.success && form?.set ? (form.set as ProvisionalSet) : null
	);

	function formatDuration(sec?: number): string {
		if (!sec) return '';
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
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

	function playWholeSet() {
		if (!currentSet || currentSet.tracks.length === 0) return;
		const summaries = currentSet.tracks.map(toTrackSummary);
		player.play(summaries[0], summaries);
	}

	function playSingleTrack(t: ProvisionalTrack) {
		if (!currentSet) return;
		const summaries = currentSet.tracks.map(toTrackSummary);
		const target = summaries.find((s) => s.id === t.id) ?? toTrackSummary(t);
		player.play(target, summaries);
	}

	async function saveToPlaylists() {
		if (!currentSet || currentSet.tracks.length === 0) return;
		const summaries = currentSet.tracks.map(toTrackSummary);
		const now = new Date();
		const title = `Generated Set (${now.toLocaleDateString()})`;
		const desc = `${currentSet.summary} · Generated via Syn Taste Engine`;

		customPlaylists.createPlaylist(title, desc, summaries);
		saveSuccess = true;
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
		a.download = `syn-set-${Date.now()}.m3u8`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Taste Engine Generator — Syn</title>
</svelte:head>

<section class="max-w-4xl space-y-8" aria-labelledby="generator-title">
	<header class="border-b-2 border-[var(--border-subtle)] pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
			SYN // THE TASTE ENGINE
		</p>
		<h1
			id="generator-title"
			class="mt-1 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl"
		>
			Generate an Honest Set
		</h1>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			A deterministic listening session curated directly from your TIDAL anchors, graph
			neighbourhood, and intent knobs. Every single pick is explainable.
		</p>
	</header>

	{#if form?.error}
		<div
			class="flex items-center gap-3 border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-sm text-[var(--text-primary)]"
			role="alert"
		>
			<AlertCircle size={18} class="shrink-0 text-[var(--danger)]" />
			<p>{form.error}</p>
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
			Session Intent Knobs
		</h2>

		<form
			method="POST"
			action="?/generate"
			use:enhance={() => {
				isGenerating = true;
				return async ({ update }) => {
					isGenerating = false;
					await update();
				};
			}}
			class="mt-6 space-y-6"
		>
			<!-- Familiarity Slider -->
			<div class="space-y-2">
				<div class="flex items-center justify-between text-sm">
					<label for="familiarity-knob" class="font-semibold text-[var(--text-primary)]">
						Familiarity ↔ Discovery
					</label>
					<span class="font-mono text-xs text-[var(--accent-gold)]">
						{familiarity}% Familiar · {100 - familiarity}% Discovery
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
					class="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-canvas)] accent-[var(--action)]"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={familiarity}
					aria-valuetext="{familiarity}% familiar, {100 - familiarity}% discovery"
				/>
				<div
					class="flex justify-between text-[0.68rem] tracking-wider text-[var(--text-muted)] uppercase"
				>
					<span>100% Discovery (Neighbourhood)</span>
					<span>Balanced</span>
					<span>100% Anchors (Loved)</span>
				</div>
			</div>

			<!-- Set Length & Seed Selection Grid -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Track Count -->
				<div class="space-y-1.5">
					<label
						for="track-count-select"
						class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						Set Size
					</label>
					<select
						id="track-count-select"
						name="targetCount"
						bind:value={targetCount}
						class="w-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)]"
					>
						<option value={15}>15 tracks (~1 hour)</option>
						<option value={20}>20 tracks (~1.3 hours)</option>
						<option value={25}>25 tracks (~1.7 hours)</option>
						<option value={30}>30 tracks (~2 hours)</option>
					</select>
				</div>

				<!-- Seed Anchor Selection -->
				<div class="space-y-1.5">
					<label
						for="seed-artist-select"
						class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						Seed Origin
					</label>
					<select
						id="seed-artist-select"
						name="seedArtistId"
						bind:value={seedArtistId}
						class="w-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)]"
					>
						<option value="">Whole Taste Profile (All Anchors)</option>
						{#each data.seedArtists as artist (artist.id)}
							<option value={artist.id}>Focus on: {artist.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex items-center gap-3 pt-2">
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={isGenerating || !data.connection.connected}
				>
					<Sparkles size={16} class={`mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
					{isGenerating ? 'Synthesizing Taste Set…' : 'Generate My Set'}
				</Button>

				{#if !data.connection.connected}
					<span class="text-xs text-[var(--danger)]">
						TIDAL connection required to expand taste graph.
					</span>
				{/if}
			</div>
		</form>
	</section>

	<!-- Provisional Generated Set Section -->
	{#if currentSet}
		<section class="space-y-4" aria-labelledby="provisional-set-heading">
			<div class="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div class="flex items-center gap-2">
							<Badge variant="accent">PROVISIONAL QUEUE</Badge>
							{#if currentSet.degraded}
								<Badge variant="tag">PARTIAL GRAPH</Badge>
							{/if}
						</div>
						<h2 id="provisional-set-heading" class="mt-2 text-xl font-bold tracking-tight">
							{currentSet.summary}
						</h2>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<Button variant="primary" size="sm" onclick={playWholeSet}>
							<Play size={14} class="mr-1.5" />
							Play Set
						</Button>

						<Button variant="secondary" size="sm" onclick={saveToPlaylists} disabled={saveSuccess}>
							{#if saveSuccess}
								<Check size={14} class="mr-1.5 text-[var(--accent-jade)]" />
								Saved!
							{:else}
								<ListMusic size={14} class="mr-1.5" />
								Save Playlist
							{/if}
						</Button>

						<Button variant="secondary" size="sm" onclick={downloadM3U8} title="Export as M3U8">
							<Download size={13} />
						</Button>
					</div>
				</div>
			</div>

			<!-- Track List with Provenance Chips -->
			<div
				class="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
			>
				{#each currentSet.tracks as track, i (track.id)}
					<div
						class="group flex items-center justify-between gap-4 p-3.5 hover:bg-[var(--surface-canvas)]"
					>
						<div class="flex min-w-0 items-center gap-3">
							<span class="w-6 text-center font-mono text-xs text-[var(--text-muted)]">
								{i + 1}
							</span>

							<button
								type="button"
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--surface-canvas)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
								onclick={() => playSingleTrack(track)}
								aria-label="Play {track.title}"
							>
								<Play size={14} />
							</button>

							<div class="min-w-0">
								<p class="truncate text-sm font-bold text-[var(--text-primary)]">
									{track.title}
								</p>
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-xs text-[var(--text-muted)]">
										{track.artists.map((a) => a.name).join(', ')}
									</span>
									<span
										class="py-0.2 inline-flex items-center rounded border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-1.5 text-[0.68rem] text-[var(--accent-gold)]"
									>
										{track.provenance}
									</span>
								</div>
							</div>
						</div>

						<div class="shrink-0 font-mono text-xs text-[var(--text-muted)]">
							{formatDuration(track.duration)}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</section>
