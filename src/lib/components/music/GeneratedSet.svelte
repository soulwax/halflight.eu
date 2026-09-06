<script lang="ts">
	import { Check, Download, ListMusic, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	import type { ProvisionalSet, ProvisionalTrack } from '#lib/taste/provisional';

	interface Props {
		set: ProvisionalSet;
		saveSuccess?: boolean;
		onPlay: () => void;
		onPlayTrack: (track: ProvisionalTrack) => void;
		onSave: () => void;
		onExport: () => void;
	}

	let { set, saveSuccess = false, onPlay, onPlayTrack, onSave, onExport }: Props = $props();

	function formatDuration(seconds?: number): string {
		if (!seconds) return '—';
		const minutes = Math.floor(seconds / 60);
		return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
	}

	function localizeConfidence(label: string): string {
		if (label.toLowerCase().startsWith('high')) return m.generate_confidence_high();
		if (label.toLowerCase().startsWith('initial')) return m.generate_confidence_initial();
		return m.generate_confidence_good();
	}
</script>

<section class="generated-set" aria-labelledby="generated-set-heading">
	<header class="generated-set-header">
		<div class="generated-set-copy">
			<p class="generated-set-eyebrow">{m.nav_generate()}</p>
			<h2 id="generated-set-heading">{m.generate_set_title()}</h2>
			<dl class="generated-set-metadata">
				<div>
					<dt>{m.playlist_track_count()}</dt>
					<dd>{set.trackCount}</dd>
				</div>
				<div>
					<dt>{m.album_duration()}</dt>
					<dd>{set.totalDurationFormatted}</dd>
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
			{#if set.degraded}
				<p class="generated-set-notice">{m.generate_degraded()}</p>
			{/if}
		</div>

		<div class="generated-set-actions" aria-label={m.generate_set_actions()}>
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
		</div>
	</header>

	<ol class="generated-track-list">
		{#each set.tracks as track, index (track.id + '-' + index)}
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
					<div class="min-w-0">
						<p class="generated-track-title">{track.title}</p>
						<p class="generated-track-artists">
							{track.artists.map((artist) => artist.name).join(', ')}
						</p>
						<p class="generated-track-provenance">
							<span class="sr-only">{m.generate_track_reason()}: </span>{track.provenance}
						</p>
					</div>
				</div>
				<span class="generated-track-duration">{formatDuration(track.duration)}</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.generated-set {
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: var(--shadow-raised);
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

	.generated-set-eyebrow,
	.generated-track-provenance {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.generated-set h2 {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.3rem, 2.5vw, 2rem);
		font-weight: 650;
		letter-spacing: -0.035em;
		line-height: 1.08;
	}

	.generated-set-metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.25rem;
		margin: 1rem 0 0;
	}

	.generated-set-metadata div {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}

	.generated-set-metadata dt,
	.generated-set-metadata dd,
	.generated-track-artists,
	.generated-track-duration {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.78rem;
	}

	.generated-set-metadata dt {
		text-transform: capitalize;
	}

	.generated-set-metadata dd {
		font-family: ui-monospace, monospace;
		font-weight: 700;
		color: var(--text-secondary);
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

	.generated-track-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.generated-track {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		min-height: 4.75rem;
		padding: 0.7rem clamp(1.25rem, 3vw, 2rem);
		border-bottom: 1px solid var(--border-subtle);
		transition: background-color 160ms ease;
	}

	.generated-track:last-child {
		border-bottom: 0;
	}

	.generated-track:hover {
		background: var(--surface-selected);
	}

	.generated-track-index,
	.generated-track-duration {
		font-family: ui-monospace, monospace;
		text-align: right;
	}

	.generated-track-main {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.generated-track-play {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: var(--surface-canvas);
		color: var(--text-secondary);
		cursor: pointer;
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
		font-size: 0.9rem;
		font-weight: 700;
	}

	.generated-track-artists {
		margin-top: 0.15rem;
	}

	.generated-track-provenance {
		margin-top: 0.25rem;
		color: var(--action);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
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
