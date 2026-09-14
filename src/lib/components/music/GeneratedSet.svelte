<script lang="ts">
	import { tick } from 'svelte';
	import { Check, Download, ListMusic, Play, RefreshCw } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import type { ProvisionalSet, ProvisionalTrack } from '#lib/taste/provisional';
	import { findSwapCandidate, reviewSwap } from '#lib/taste/review.js';
	import {
		localizeConfidence,
		localizeDurationCoverage,
		localizeProvenanceReason,
		localizeSetDuration,
		localizeSetSummary
	} from '#lib/taste/presentation.js';

	interface Props {
		set: ProvisionalSet;
		saveSuccess?: boolean;
		onPlay: () => void;
		onPlayTrack: (track: ProvisionalTrack) => void;
		onSave: () => void;
		onExport: () => void;
		/** Receives the set after a slot swap; without it the review offers no Swap action. */
		onSetChange?: (set: ProvisionalSet) => void;
	}

	let {
		set,
		saveSuccess = false,
		onPlay,
		onPlayTrack,
		onSave,
		onExport,
		onSetChange
	}: Props = $props();

	let trackList = $state<HTMLOListElement | undefined>(undefined);
	let swapAnnouncement = $state<{ generatedAt: string; text: string } | null>(null);

	function canSwap(index: number): boolean {
		return onSetChange !== undefined && findSwapCandidate(set, index) !== null;
	}

	function swap(index: number): void {
		const result = reviewSwap(set, index);
		if (!result || !onSetChange) return;

		onSetChange(result.set);
		swapAnnouncement = {
			generatedAt: set.generatedAt,
			text: m.generate_swapped_track({
				position: index + 1,
				previous: result.previous.title,
				replacement: result.replacement.title
			})
		};
		// Rows are keyed by position, so the focused Swap button survives the swap. When
		// that slot has nothing left to offer the button leaves; keep focus in its row.
		void tick().then(() => {
			const row = trackList?.children.item(index);
			if (row && !row.contains(document.activeElement)) {
				row.querySelector<HTMLButtonElement>('.generated-track-play')?.focus();
			}
		});
	}

	function formatDuration(seconds?: number): string {
		if (!seconds) return '—';
		const minutes = Math.floor(seconds / 60);
		return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
	}

	const durationCoverage = $derived(localizeDurationCoverage(set));
	const isEmpty = $derived(set.trackCount === 0);
</script>

<section class="generated-set" aria-labelledby="generated-set-heading">
	<header class="generated-set-header">
		<div class="generated-set-copy">
			<p class="generated-set-eyebrow">{m.nav_generate()}</p>
			<h2 id="generated-set-heading">{m.generate_set_title()}</h2>
			{#if isEmpty}
				<p class="generated-set-empty">{m.taste_set_cold_start()}</p>
			{:else}
				<p class="generated-set-summary">{localizeSetSummary(set)}</p>
				<dl class="generated-set-metadata">
					<div>
						<dt>{m.playlist_track_count()}</dt>
						<dd>{set.trackCount}</dd>
					</div>
					<div>
						<dt>{m.album_duration()}</dt>
						<dd>{localizeSetDuration(set)}</dd>
					</div>
					<div>
						<dt>{m.generate_discovery()}</dt>
						<dd>{set.discoveryPercentage}%</dd>
					</div>
					<div>
						<dt>{m.generate_confidence()}</dt>
						<dd>{localizeConfidence(set.confidenceLabel)}</dd>
					</div>
				</dl>
				{#if durationCoverage}
					<p class="generated-set-duration-note">{durationCoverage}</p>
				{/if}
			{/if}
			{#if set.degraded}
				<p class="generated-set-notice">{m.generate_degraded()}</p>
			{/if}
		</div>

		{#if !isEmpty}
			<div class="generated-set-actions" role="group" aria-label={m.generate_set_actions()}>
				<Button variant="primary" size="sm" onclick={onPlay}>
					<Play size={14} fill="currentColor" />
					{m.player_play_all()}
				</Button>
				<Button variant="secondary" size="sm" onclick={onSave} disabled={saveSuccess}>
					{#if saveSuccess}
						<Check size={14} class="text-[var(--accent-jade)]" />
						{m.generate_saved()}
					{:else}
						<ListMusic size={14} />
						{m.playlist_save()}
					{/if}
				</Button>
				<Button variant="secondary" size="sm" onclick={onExport} title={m.action_export_m3u8()}>
					<Download size={14} />
					<span class="sr-only">{m.action_export_m3u8()}</span>
				</Button>
				{#if saveSuccess}
					<p class="generated-set-saved" role="status">{m.generate_saved()}</p>
				{/if}
			</div>
		{/if}
	</header>

	{#if !isEmpty}
		<ol class="generated-track-list" bind:this={trackList}>
			<!-- Keyed by position: a swap replaces a slot's track, not its row, so focus stays put. -->
			{#each set.tracks as track, index (index)}
				<li class="generated-track">
					<span class="generated-track-index" aria-hidden="true">{index + 1}</span>
					<div class="generated-track-main">
						<button
							type="button"
							class="generated-track-play"
							onclick={() => onPlayTrack(track)}
							aria-label={`${m.player_play_track()}: ${track.title}`}
						>
							<Play size={14} fill="currentColor" />
						</button>
						{#if canSwap(index)}
							<button
								type="button"
								class="generated-track-swap"
								onclick={() => swap(index)}
								aria-label={m.generate_swap_track({ title: track.title })}
							>
								<RefreshCw size={14} aria-hidden="true" />
							</button>
						{/if}
						<div class="min-w-0">
							<p class="generated-track-title">{track.title}</p>
							<p class="generated-track-artists">
								{track.artists.map((artist) => artist.name).join(', ')}
							</p>
							<p class="generated-track-provenance">
								<span class="sr-only">{m.generate_track_reason()}: </span>{localizeProvenanceReason(
									track.reason
								)}
							</p>
						</div>
					</div>
					<span class="generated-track-duration">{formatDuration(track.duration)}</span>
				</li>
			{/each}
		</ol>
		<p class="sr-only" role="status">
			{swapAnnouncement?.generatedAt === set.generatedAt ? swapAnnouncement.text : ''}
		</p>
	{/if}
</section>

<style>
	.generated-set {
		overflow: hidden;
		border: var(--module-border);
		border-radius: var(--module-radius);
		background: var(--module-bg);
		box-shadow: var(--module-shadow);
	}

	.generated-set-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		padding: clamp(1.25rem, 3vw, 2rem);
		border-bottom: 1px solid var(--border-subtle);
	}

	.generated-set-copy {
		min-width: 0;
	}

	.generated-set-eyebrow {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.generated-set h2 {
		margin: 0.4rem 0 0;
		font-size: clamp(1.3rem, 2.5vw, 2rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.generated-set-metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin: 1rem 0 0;
	}

	.generated-set-summary,
	.generated-set-empty,
	.generated-set-duration-note {
		margin: 0.7rem 0 0;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
		line-height: 1.45;
	}

	.generated-set-duration-note {
		color: var(--text-muted);
		font-size: var(--fs-xs);
	}

	.generated-set-empty {
		max-width: 36rem;
	}

	.generated-set-metadata div {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 4.75rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
	}

	.generated-set-metadata dt,
	.generated-set-metadata dd,
	.generated-track-artists,
	.generated-track-duration {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--fs-2xs);
	}

	.generated-set-metadata dt {
		color: var(--text-muted);
	}

	.generated-set-metadata dd {
		font-weight: 650;
		color: var(--text-primary);
	}

	.generated-set-notice {
		margin: 1rem 0 0;
		max-width: 48rem;
		color: var(--text-secondary);
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.generated-set-actions {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.generated-set-saved {
		flex-basis: 100%;
		margin: 0.15rem 0 0;
		color: var(--success);
		font-size: var(--fs-sm);
		font-weight: 600;
		text-align: right;
	}

	.generated-track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.generated-track {
		display: grid;
		grid-template-columns: 2.25rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		min-height: 5.25rem;
		padding: 0.75rem clamp(1.25rem, 3vw, 2rem);
		border-bottom: 1px solid var(--border-subtle);
		transition:
			background-color var(--dur-fast) var(--ease-out),
			box-shadow var(--dur-fast) var(--ease-out);
	}

	.generated-track:last-child {
		border-bottom: 0;
	}

	.generated-track:hover {
		background: var(--surface-selected);
	}

	.generated-track:focus-within {
		background: color-mix(in oklab, var(--surface-selected) 58%, var(--surface-raised));
	}

	.generated-track-index,
	.generated-track-duration {
		font-family: ui-monospace, monospace;
		text-align: right;
	}

	.generated-track-main {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.generated-track-play {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-canvas);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.generated-track-swap {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.generated-track-swap:hover,
	.generated-track-swap:focus-visible {
		border-color: var(--action);
		color: var(--action);
	}

	.generated-track-play:hover,
	.generated-track-play:focus-visible {
		border-color: var(--action);
		color: var(--action);
	}

	.generated-track-title,
	.generated-track-artists,
	.generated-track-provenance {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.generated-track-title {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--fs-base);
		font-weight: 650;
	}

	.generated-track-artists {
		margin-top: 0.15rem;
	}

	.generated-track-provenance {
		display: inline-block;
		max-width: 100%;
		margin-top: 0.3rem;
		color: var(--text-secondary);
		font-size: var(--fs-2xs);
		font-weight: 600;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	@container (max-width: 40rem) {
		.generated-set-header {
			flex-direction: column;
		}

		.generated-set-actions {
			justify-content: flex-start;
		}

		.generated-set-saved {
			text-align: left;
		}
	}

	@container (max-width: 28rem) {
		.generated-track {
			grid-template-columns: 1.5rem minmax(0, 1fr);
			padding-inline: 1rem;
		}

		.generated-track-duration {
			display: none;
		}
	}
</style>
