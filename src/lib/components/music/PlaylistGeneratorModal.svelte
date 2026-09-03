<script lang="ts">
	import { CheckCircle2, Cloud, Disc, Sparkles, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists, type CustomPlaylist } from '#lib/player/customPlaylists.svelte';
	import { player } from '#lib/player/player.svelte';
	import type { TrackSummary } from '#lib/tidal/models';

	let selectedVibe = $state('kinetic');
	let selectedEra = $state('contemporary');
	let selectedTexture = $state('synthesizers');
	let selectedEnergyArc = $state('steady');
	let selectedSize = $state(20);

	let isGenerating = $state(false);
	let statusText = $state('');
	let errorMessage = $state<string | null>(null);
	let successAccountSaved = $state(false);
	let tidalExported = $state(false);

	const VIBES = [
		{
			id: 'kinetic',
			label: 'HIGH KINETIC',
			sub: 'Synth / French Touch / Darkwave / Club',
			color: 'var(--bauhaus-blue)'
		},
		{
			id: 'postpunk',
			label: 'POST-PUNK & ART ROCK',
			sub: 'Coldwave / Krautrock / Bauhaus Gothic',
			color: 'var(--bauhaus-red)'
		},
		{
			id: 'funk',
			label: 'COSMIC FUNK & SOUL',
			sub: 'Rare Groove / Space Disco / Neo-Soul',
			color: 'var(--bauhaus-yellow)'
		},
		{
			id: 'noir',
			label: 'LATE NOIR & TRIP-HOP',
			sub: 'Bristol Sound / Dark Jazz / Downtempo',
			color: 'var(--border-strong)'
		},
		{
			id: 'techno',
			label: 'DETROIT TECHNO & MINIMAL',
			sub: 'Dub Techno / Motor City / Berlin Acid',
			color: 'var(--bauhaus-blue)'
		},
		{
			id: 'shoegaze',
			label: 'ETHEREAL SHOEGAZE',
			sub: 'Dream Pop / Lush Reverb / Melodic Fuzz',
			color: 'var(--bauhaus-red)'
		},
		{
			id: 'jazz',
			label: 'MODAL JAZZ & FUSION',
			sub: 'Blue Note 60s / Spiritual Jazz / ECM',
			color: 'var(--bauhaus-yellow)'
		},
		{
			id: 'ambient',
			label: 'AVANT-GARDE AMBIENT',
			sub: 'Modular Synthesis / Drone / Modern Classical',
			color: 'var(--border-strong)'
		}
	];

	const ERAS = [
		{ id: 'contemporary', label: 'CONTEMPORARY', sub: '2020s & Fresh Horizons' },
		{ id: 'golden', label: 'GOLDEN CYCLE', sub: '2000s & 2010s Anthems' },
		{ id: 'vintage', label: 'ANALOG WAVE', sub: '80s & 90s Vintage Wave' },
		{ id: 'foundation', label: 'ARCHITECTURAL ROOTS', sub: '60s & 70s Foundation' },
		{ id: 'timeless', label: 'CONTINUUM', sub: 'All Eras Intertwined' }
	];

	const TEXTURES = [
		{ id: 'synthesizers', label: 'ANALOG SYNTHS' },
		{ id: 'organic', label: 'ORGANIC & ACOUSTIC' },
		{ id: 'motorik', label: 'HYPNOTIC MOTORIK' },
		{ id: 'atmospheric', label: 'DENSE ATMOSPHERE' }
	];

	const ENERGY_ARCS = [
		{ id: 'steady', label: 'STEADY DEEP GROOVE' },
		{ id: 'accelerando', label: 'ACCELERANDO (BUILDING)' },
		{ id: 'peak', label: 'MAXIMUM VOLTAGE' },
		{ id: 'chill', label: 'LATE NIGHT REVERIE' }
	];

	const SIZES = [
		{ value: 12, label: '12 TRACKS (EP ~45m)' },
		{ value: 20, label: '20 TRACKS (LP ~75m)' },
		{ value: 30, label: '30 TRACKS (ODYSSEY ~2h)' }
	];

	async function handleSynthesize() {
		isGenerating = true;
		errorMessage = null;
		successAccountSaved = false;
		tidalExported = false;
		statusText = 'CONNECTING TO TIDAL CORE...';

		try {
			setTimeout(() => {
				if (isGenerating) statusText = 'SCANNING FREQUENCIES ACROSS CATALOGUE...';
			}, 600);
			setTimeout(() => {
				if (isGenerating) statusText = 'CALCULATING TEMPO & SHAPING ENERGY ARC...';
			}, 1300);
			setTimeout(() => {
				if (isGenerating) statusText = 'PERSISTING PLAYLIST TO ACCOUNT DATABASE...';
			}, 2100);

			const response = await fetch('/api/generate-playlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					vibe: selectedVibe,
					era: selectedEra,
					texture: selectedTexture,
					energyArc: selectedEnergyArc,
					size: selectedSize
				})
			});

			if (!response.ok) {
				throw new Error('Failed to synthesize playlist');
			}

			const data = (await response.json()) as {
				playlist: CustomPlaylist;
				title: string;
				description: string;
				tracks: TrackSummary[];
				savedToAccount: boolean;
				tidalPlaylistId?: string | null;
			};

			if (!data.tracks || data.tracks.length === 0) {
				throw new Error('No tracks found for this combination.');
			}

			successAccountSaved = true;
			if (data.tidalPlaylistId) {
				tidalExported = true;
			}

			// Add/sync to client playlists state
			customPlaylists.createPlaylist(data.title, data.description, data.tracks, data.playlist);

			// Automatically queue and begin playback
			player.play(data.tracks[0], data.tracks);

			statusText = data.tidalPlaylistId
				? 'SAVED TO SYN ACCOUNT & EXPORTED TO TIDAL!'
				: 'SAVED PERMANENTLY TO YOUR SYN ACCOUNT!';

			// Wait a brief moment to celebrate success, then close
			setTimeout(() => {
				customPlaylists.closeGenerator();
				isGenerating = false;
			}, 900);
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Playlist generation failed.';
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
					<p class="eyebrow">SYN // AUTOMATED COMPOSER & ACCOUNT ARCHIVIST</p>
					<h2 id="generator-title">GENERATE & ARCHIVE PLAYLIST</h2>
				</div>
			</div>
			<button
				type="button"
				class="close-btn"
				disabled={isGenerating}
				onclick={() => customPlaylists.closeGenerator()}
				aria-label={m.action_close()}
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

			<!-- Question 1: Vibe / Soundscape -->
			<section class="question-group">
				<p class="group-label">01 // SELECT SOUNDSCAPE ARCHETYPE</p>
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

			<!-- Question 2: Era Horizon -->
			<section class="question-group">
				<p class="group-label">02 // SELECT ERA HORIZON</p>
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

			<!-- Question 3: Sonic Texture -->
			<section class="question-group">
				<p class="group-label">03 // SONIC TEXTURE & CHARACTER</p>
				<div class="chip-row">
					{#each TEXTURES as tex (tex.id)}
						<button
							type="button"
							class="chip-btn"
							class:chip-selected={selectedTexture === tex.id}
							onclick={() => (selectedTexture = tex.id)}
						>
							{tex.label}
						</button>
					{/each}
				</div>
			</section>

			<!-- Question 4: Energy Arc & Length -->
			<div class="dual-row">
				<section class="question-group flex-1">
					<p class="group-label">04 // ENERGY FLOW & ARC</p>
					<div class="chip-row">
						{#each ENERGY_ARCS as arc (arc.id)}
							<button
								type="button"
								class="chip-btn"
								class:chip-selected={selectedEnergyArc === arc.id}
								onclick={() => (selectedEnergyArc = arc.id)}
							>
								{arc.label}
							</button>
						{/each}
					</div>
				</section>

				<section class="question-group">
					<p class="group-label">05 // SCALE</p>
					<div class="chip-row">
						{#each SIZES as s (s.value)}
							<button
								type="button"
								class="chip-btn"
								class:chip-selected={selectedSize === s.value}
								onclick={() => (selectedSize = s.value)}
							>
								{s.label}
							</button>
						{/each}
					</div>
				</section>
			</div>
		</div>

		<footer class="modal-footer">
			{#if isGenerating}
				<div class="generating-status">
					<div class="pulse-dot"></div>
					<span class="font-mono text-xs">{statusText}</span>
				</div>
			{:else if successAccountSaved}
				<div class="success-status">
					<CheckCircle2 size={16} class="text-[var(--action)]" />
					<span class="font-mono text-xs">ARCHIVED IN ACCOUNT</span>
					{#if tidalExported}
						<Cloud size={14} class="ml-1 text-[var(--bauhaus-blue)]" />
					{/if}
				</div>
			{:else}
				<div class="footer-info">
					<Cloud size={14} class="text-[var(--action)]" />
					<span class="footer-hint">Saves directly to your Syn account & syncs across devices.</span
					>
				</div>
			{/if}

			<button type="button" class="submit-btn" disabled={isGenerating} onclick={handleSynthesize}>
				{#if isGenerating}
					<Disc size={18} class="animate-spin" />
					COMPOSING...
				{:else}
					<Sparkles size={18} />
					SYNTHESIZE & ARCHIVE
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
		width: calc(100% - 2.5rem);
		max-width: 46rem;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-xl, 18px);
		box-shadow:
			0 24px 56px -8px rgba(0, 0, 0, 0.55),
			4px 4px 0px var(--border-strong);
		z-index: 160;
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		overflow: hidden;
		animation: scaleUp 0.15s ease;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.75rem;
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
		border-radius: var(--radius-full, 9999px);
		overflow: hidden;
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
		border-radius: var(--radius-sm, 6px);
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
		padding: 1.5rem 1.75rem;
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
		grid-template-columns: repeat(auto-fit, minmax(14.5rem, 1fr));
		gap: 0.75rem;
	}

	.vibe-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-md, 10px);
		background: var(--surface-canvas);
		text-align: left;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.vibe-btn:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.vibe-selected {
		border-color: var(--action);
		background: var(--surface-selected);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.vibe-color-indicator {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: var(--radius-full, 9999px);
		flex: 0 0 auto;
	}

	.vibe-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.vibe-text strong {
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.vibe-text span {
		font-size: 0.7rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.era-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.55rem;
	}

	.era-btn {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 0.85rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-md, 8px);
		background: var(--surface-canvas);
		text-align: left;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.era-btn:hover {
		border-color: var(--border-strong);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.era-selected {
		border-color: var(--action);
		background: var(--surface-selected);
		box-shadow: 2px 2px 0px var(--border-strong);
	}

	.era-btn strong {
		font-size: 0.75rem;
		font-weight: 800;
	}

	.era-btn span {
		font-size: 0.65rem;
		color: var(--text-muted);
	}

	.dual-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.chip-btn {
		padding: 0.55rem 0.95rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.chip-btn:hover {
		border-color: var(--border-strong);
	}

	.chip-selected {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.75rem;
		border-top: 2px solid var(--border-subtle);
		background: var(--surface-canvas);
		gap: 1rem;
	}

	.footer-info {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.footer-hint {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.generating-status,
	.success-status {
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
		padding: 0.85rem 1.5rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-md, 8px);
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
