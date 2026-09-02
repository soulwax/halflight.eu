<script lang="ts">
	import { Disc, Sparkles, X } from '@lucide/svelte';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { player } from '#lib/player/player.svelte';
	import type { TrackSummary } from '#lib/server/tidal/models';

	let selectedVibe = $state('energy');
	let selectedEra = $state('modern');
	let selectedFocus = $state('energy');
	let isGenerating = $state(false);
	let statusText = $state('');
	let errorMessage = $state<string | null>(null);

	const VIBES = [
		{
			id: 'energy',
			label: 'HIGH KINETIC',
			sub: 'Electronic / Synth / Club / Dance',
			color: 'var(--bauhaus-blue)'
		},
		{
			id: 'rock',
			label: 'RAW FREQUENCY',
			sub: 'Post-Punk / Alternative / Garage Rock',
			color: 'var(--bauhaus-red)'
		},
		{
			id: 'warm',
			label: 'ORGANIC GROOVE',
			sub: 'Soul / Funk / Disco / R&B',
			color: 'var(--bauhaus-yellow)'
		},
		{
			id: 'noir',
			label: 'LATE NOIR',
			sub: 'Ambient / Downtempo / Dark Jazz',
			color: 'var(--border-strong)'
		}
	];

	const ERAS = [
		{ id: 'modern', label: 'CONTEMPORARY', sub: '2020s & Fresh Releases' },
		{ id: 'golden', label: 'GOLDEN CYCLE', sub: '2000s & 2010s Anthems' },
		{ id: 'vintage', label: 'ANALOG WAVE', sub: '80s & 90s Vintage Wave' },
		{ id: 'classics', label: 'FOUNDATION', sub: '60s & 70s Roots' }
	];

	const FOCUS_MODES = [
		{ id: 'energy', label: 'DRIVING ENERGY' },
		{ id: 'focus', label: 'DEEP FOCUS / CHILL' },
		{ id: 'vocal', label: 'VOCAL ANTHEMS' }
	];

	async function handleSynthesize() {
		isGenerating = true;
		errorMessage = null;
		statusText = 'CONNECTING TO TIDAL CORE...';

		try {
			setTimeout(() => {
				if (isGenerating) statusText = 'SCANNING CATALOGUE FOR FREQUENCIES...';
			}, 600);
			setTimeout(() => {
				if (isGenerating) statusText = 'SYNTHESIZING ON-THE-FLY PLAYLIST...';
			}, 1400);

			const response = await fetch('/api/generate-playlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					vibe: selectedVibe,
					era: selectedEra,
					focus: selectedFocus
				})
			});

			if (!response.ok) {
				throw new Error('Failed to generate playlist');
			}

			const data = (await response.json()) as {
				title: string;
				description: string;
				tracks: TrackSummary[];
			};

			if (!data.tracks || data.tracks.length === 0) {
				throw new Error('No tracks found for this combination.');
			}

			// Save to user's custom playlists
			customPlaylists.createPlaylist(data.title, data.description, data.tracks);

			// Immediately launch playback
			player.play(data.tracks[0], data.tracks);

			customPlaylists.closeGenerator();
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Playlist generation failed.';
		} finally {
			isGenerating = false;
		}
	}
</script>

{#if customPlaylists.isGeneratorOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		onclick={() => !isGenerating && customPlaylists.closeGenerator()}
	></div>

	<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="generator-title">
		<header class="modal-header">
			<div class="header-main">
				<div class="tricolor-badge">
					<span class="bar bar-blue"></span>
					<span class="bar bar-red"></span>
					<span class="bar bar-yellow"></span>
				</div>
				<div>
					<p class="eyebrow">SYN // AUTOMATED COMPOSER</p>
					<h2 id="generator-title">GENERATE INSTANT PLAYLIST</h2>
				</div>
			</div>
			<button
				type="button"
				class="close-btn"
				disabled={isGenerating}
				onclick={() => customPlaylists.closeGenerator()}
				aria-label="Close"
			>
				<X size={18} />
			</button>
		</header>

		<div class="modal-body">
			{#if errorMessage}
				<div class="error-banner" role="alert">
					{errorMessage}
				</div>
			{/if}

			<!-- Question 1: Vibe -->
			<section class="question-group">
				<p class="group-label">01 // SELECT SOUNDSCAPE / FREQUENCY</p>
				<div class="vibe-grid">
					{#each VIBES as vibe (vibe.id)}
						<button
							type="button"
							class="vibe-btn"
							class:vibe-selected={selectedVibe === vibe.id}
							onclick={() => (selectedVibe = vibe.id)}
						>
							<span class="vibe-color-indicator" style="background: {vibe.color}"></span>
							<div class="vibe-text">
								<strong>{vibe.label}</strong>
								<span>{vibe.sub}</span>
							</div>
						</button>
					{/each}
				</div>
			</section>

			<!-- Question 2: Era -->
			<section class="question-group">
				<p class="group-label">02 // SELECT ERA CYCLE</p>
				<div class="era-grid">
					{#each ERAS as era (era.id)}
						<button
							type="button"
							class="era-btn"
							class:era-selected={selectedEra === era.id}
							onclick={() => (selectedEra = era.id)}
						>
							<strong>{era.label}</strong>
							<span>{era.sub}</span>
						</button>
					{/each}
				</div>
			</section>

			<!-- Question 3: Focus Mode -->
			<section class="question-group">
				<p class="group-label">03 // PACING / INTENSITY</p>
				<div class="focus-row">
					{#each FOCUS_MODES as focus (focus.id)}
						<button
							type="button"
							class="focus-btn"
							class:focus-selected={selectedFocus === focus.id}
							onclick={() => (selectedFocus = focus.id)}
						>
							{focus.label}
						</button>
					{/each}
				</div>
			</section>
		</div>

		<footer class="modal-footer">
			{#if isGenerating}
				<div class="generating-status">
					<div class="pulse-dot"></div>
					<span class="font-mono text-xs">{statusText}</span>
				</div>
			{:else}
				<p class="footer-hint">Composes 20 tracks & launches audio engine immediately.</p>
			{/if}

			<button type="button" class="submit-btn" disabled={isGenerating} onclick={handleSynthesize}>
				{#if isGenerating}
					<Disc size={18} class="animate-spin" />
					COMPOSING...
				{:else}
					<Sparkles size={18} />
					SYNTHESIZE & PLAY
				{/if}
			</button>
		</footer>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		z-index: 150;
		animation: fadeIn 0.15s ease;
	}

	.modal-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: calc(100% - 2rem);
		max-width: 38rem;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		box-shadow: 8px 8px 0px rgba(0, 0, 0, 0.5);
		z-index: 160;
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		animation: scaleUp 0.15s ease;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.header-main {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.tricolor-badge {
		display: flex;
		flex-direction: column;
		gap: 3px;
		width: 6px;
		height: 28px;
	}

	.bar {
		flex: 1;
		width: 100%;
	}
	.bar-blue {
		background: var(--bauhaus-blue);
	}
	.bar-red {
		background: var(--bauhaus-red);
	}
	.bar-yellow {
		background: var(--bauhaus-yellow);
	}

	.eyebrow {
		margin: 0 0 0.15rem;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: var(--text-muted);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}

	.close-btn {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.close-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
		color: var(--text-primary);
		background: var(--surface-selected);
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.group-label {
		display: block;
		margin-bottom: 0.65rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.vibe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.75rem;
	}

	.vibe-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		text-align: left;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.vibe-btn:hover {
		border-color: var(--border-strong);
	}

	.vibe-selected {
		border-color: var(--action);
		background: var(--surface-selected);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.vibe-color-indicator {
		width: 0.75rem;
		height: 0.75rem;
		flex: 0 0 auto;
	}

	.vibe-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.vibe-text strong {
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.vibe-text span {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.era-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.5rem;
	}

	.era-btn {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.65rem 0.75rem;
		border: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		text-align: left;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.era-btn:hover {
		border-color: var(--border-strong);
	}

	.era-selected {
		border-color: var(--action);
		background: var(--surface-selected);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.era-btn strong {
		font-size: 0.8rem;
		font-weight: 800;
	}

	.era-btn span {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.focus-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.focus-btn {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.focus-btn:hover {
		border-color: var(--border-strong);
	}

	.focus-selected {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-top: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		gap: 1rem;
	}

	.footer-hint {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.generating-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--action);
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		background: var(--bauhaus-red);
		border-radius: 50%;
		animation: pulse 1s infinite;
	}

	.submit-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.4rem;
		border: 2px solid var(--border-strong);
		background: var(--action);
		color: var(--action-contrast);
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
		box-shadow: 3px 3px 0px var(--border-strong);
	}

	.submit-btn:hover:not(:disabled) {
		transform: translate(-1px, -1px);
		box-shadow: 4px 4px 0px var(--border-strong);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		border: 2px solid var(--danger);
		background: var(--danger-subtle);
		color: var(--danger);
		font-size: 0.85rem;
		font-weight: 700;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes scaleUp {
		from {
			opacity: 0;
			transform: translate(-50%, -48%) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.85);
		}
	}
</style>
