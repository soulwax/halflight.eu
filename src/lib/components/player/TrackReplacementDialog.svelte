<script lang="ts">
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { replacementOffer } from '#lib/player/replacement.svelte';
	import { player } from '#lib/player/player.svelte';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import { formatDuration } from '#lib/format';
	import type { TrackSummary } from '#lib/tidal/models';
	import { Disc, LoaderCircle } from '@lucide/svelte';
	type Candidate = { track: TrackSummary; match: 'isrc' | 'best_fit' };
	let open = $derived(Boolean(replacementOffer.trackId));
	let source = $state<TrackSummary | null>(null);
	let candidates = $state<Candidate[]>([]);
	let playlists = $state<{ id: string; title: string; version: string }[]>([]);
	let selectedPlaylist = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let failure = $state<'load' | 'save' | 'changed' | null>(null);
	let failedArtwork = $state<string[]>([]);
	let controller: AbortController | null = null;
	let generation = 0;
	$effect(() => {
		const id = replacementOffer.trackId;
		if (id) void load(id);
		else {
			controller?.abort();
			generation++;
		}
	});
	onDestroy(() => {
		controller?.abort();
		replacementOffer.trackId = null;
	});
	async function load(id: string): Promise<void> {
		controller?.abort();
		controller = new AbortController();
		const version = ++generation;
		loading = true;
		saving = false;
		failure = null;
		source = null;
		candidates = [];
		failedArtwork = [];
		playlists = [];
		selectedPlaylist = '';
		try {
			const response = await fetch(`/api/tracks/${encodeURIComponent(id)}/replacements`, {
				signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)])
			});
			if (!response.ok) throw new Error('Suggestions unavailable');
			const body = await response.json();
			if (version !== generation || replacementOffer.trackId !== id) return;
			source = body.source;
			candidates = body.candidates;
			playlists = body.playlists;
			selectedPlaylist =
				playlists.find((playlist) => playlist.title === player.currentTrack?.provenance)?.id ??
				playlists[0]?.id ??
				'';
		} catch {
			if (version === generation && replacementOffer.trackId === id) failure = 'load';
		} finally {
			if (version === generation) loading = false;
		}
	}
	async function choose(candidate: Candidate): Promise<void> {
		const id = replacementOffer.trackId;
		if (!id || saving) return;
		saving = true;
		const requestGeneration = generation;
		const isCurrent = () => requestGeneration === generation && replacementOffer.trackId === id;
		failure = null;
		const playlist = playlists.find((entry) => entry.id === selectedPlaylist);
		try {
			const response = await fetch(`/api/tracks/${encodeURIComponent(id)}/replacements`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					candidateId: candidate.track.id,
					playlistId: playlist?.id ?? null,
					version: playlist?.version
				}),
				signal: AbortSignal.timeout(60_000)
			});
			if (!response.ok) {
				if (isCurrent()) failure = response.status === 409 ? 'changed' : 'save';
				return;
			}
			const body = (await response.json()) as { track: TrackSummary };
			if (isCurrent()) {
				player.applyRecordingReplacement(id, body.track, playlist?.title);
				replacementOffer.trackId = null;
			}
			if (playlist) {
				await customPlaylists.syncWithServer();
				await invalidateAll();
			}
		} catch {
			if (isCurrent()) failure = 'save';
		} finally {
			if (requestGeneration === generation) saving = false;
		}
	}
</script>

<Dialog
	{open}
	onOpenChange={(value) => {
		if (!value) replacementOffer.trackId = null;
	}}
	title={m.replacement_title()}
	description={m.replacement_description()}
>
	<div class="replacement-body" aria-busy={loading || saving}>
		{#if loading}<p class="loading" role="status">
				<LoaderCircle size={20} class="animate-spin" aria-hidden="true" />{m.replacement_checking()}
			</p>
		{:else}
			{#if source}<p class="source">
					{source.title} · {source.artists.map((artist) => artist.name).join(', ')}
				</p>{/if}
			{#if failure}<p role="alert">
					{failure === 'changed' ? m.replacement_changed() : m.replacement_failed()}
				</p>
				<Button
					disabled={saving}
					onclick={() => replacementOffer.trackId && load(replacementOffer.trackId)}
					>{m.track_retry()}</Button
				>
			{:else if !candidates.length}<p role="status">{m.replacement_empty()}</p>{/if}
			{#if playlists.length}
				<label
					>{m.replacement_destination()}<select bind:value={selectedPlaylist} disabled={saving}
						>{#each playlists as playlist (playlist.id)}<option value={playlist.id}
								>{playlist.title}</option
							>{/each}<option value="">{m.replacement_play_only()}</option></select
					></label
				>
				<p class="hint">{m.replacement_local_copy()}</p>
			{/if}
			<ul>
				{#each candidates as candidate (candidate.track.id)}<li>
						<div class="identity">
							<span class="artwork"
								>{#if trackArtworkUrl(candidate.track, 80) && !failedArtwork.includes(candidate.track.id)}<img
										src={trackArtworkUrl(candidate.track, 80) ?? undefined}
										alt=""
										width="48"
										height="48"
										onerror={() => (failedArtwork = [...failedArtwork, candidate.track.id])}
									/>{:else}<Disc size={22} aria-hidden="true" />{/if}</span
							>
							<div class="copy">
								<strong>{candidate.track.title}</strong><span
									>{candidate.track.artists.map((artist) => artist.name).join(', ')}</span
								><small
									>{candidate.track.album?.title}{candidate.track.duration
										? ` · ${formatDuration(candidate.track.duration)}`
										: ''}</small
								><small class="match"
									>{candidate.match === 'isrc'
										? m.replacement_exact()
										: m.replacement_best_fit()}</small
								>
							</div>
						</div>
						<Button disabled={saving || failure === 'changed'} onclick={() => choose(candidate)}
							>{selectedPlaylist ? m.replacement_save_play() : m.replacement_play()}</Button
						>
					</li>{/each}
			</ul>
			{#if saving}<p role="status">{m.replacement_saving()}</p>{/if}
		{/if}
	</div>
</Dialog>

<style>
	.replacement-body {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}
	p {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.source,
	.hint,
	small {
		color: var(--text-muted);
	}
	.hint {
		font-size: 0.875rem;
	}
	.loading {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.5rem;
	}
	select {
		min-height: 3rem;
		width: 100%;
		min-width: 0;
		color: var(--text-primary);
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		font: inherit;
		padding: 0.5rem;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	li {
		display: grid;
		gap: 0.75rem;
		padding-block: 1rem;
		border-top: 1px solid var(--border-subtle);
	}
	.identity {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		min-width: 0;
	}
	.artwork {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 3rem;
		height: 3rem;
		background: var(--surface-selected);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.copy {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.match {
		color: var(--action);
	}
	:global(.replacement-body .btn-base) {
		min-height: 3rem;
	}
	select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
