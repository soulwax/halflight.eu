<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ChevronDown,
		ChevronUp,
		Disc,
		ExternalLink,
		ListMusic,
		Loader2,
		Maximize2,
		Mic2,
		Minimize2,
		Pause,
		Play,
		Plus,
		Search,
		SkipBack,
		SkipForward,
		Sparkles,
		Volume2,
		VolumeX,
		X
	} from '@lucide/svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	const tidalEmbedUrl = $derived(
		player.currentTrack
			? `https://embed.tidal.com/tracks/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);

	const tidalTrackUrl = $derived(
		player.currentTrack
			? `https://tidal.com/browse/track/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);

	function formatDuration(seconds: number): string {
		if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${String(secs).padStart(2, '0')}`;
	}

	function handleSeek(event: Event) {
		const target = event.target as HTMLInputElement;
		player.seek(parseFloat(target.value));
	}

	function handleVolume(event: Event) {
		const target = event.target as HTMLInputElement;
		player.setVolume(parseFloat(target.value));
	}

	$effect(() => {
		if (player.isLyricsOpen && player.activeLyricIndex >= 0) {
			const activeEl = document.querySelector('.lyric-line-btn.active');
			if (activeEl) {
				activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	});
</script>

<aside
	class="mini-player"
	class:expanded={player.isExpanded && player.currentTrack}
	class:idle-dock={!player.currentTrack}
	aria-label="Audio Player"
	role="region"
>
	{#if player.currentTrack}
		<!-- Main Player Bar -->
		<div class="player-bar">
			<!-- Section 1: Track Info with Small Expandable Cover as Play/Pause Button -->
			<div class="track-meta">
				<div class="cover-container" class:cover-playing={player.isPlaying}>
					<button
						type="button"
						class="cover-btn"
						onclick={() => player.togglePlayPause()}
						title={player.isPlaying ? 'Pause' : 'Play'}
						aria-label={player.isPlaying ? 'Pause' : 'Play'}
					>
						{#if player.currentTrack.imageUrl}
							<img class="cover-img" src={player.currentTrack.imageUrl} alt="" aria-hidden="true" />
						{:else if player.currentTrack.album?.imageUrl}
							<img
								class="cover-img"
								src={player.currentTrack.album.imageUrl}
								alt=""
								aria-hidden="true"
							/>
						{:else}
							<div class="cover-placeholder" aria-hidden="true"><Disc size={18} /></div>
						{/if}

						<!-- Play/Pause Overlay on the Album Cover -->
						<div class="cover-overlay" class:force-visible={!player.isPlaying || player.isLoading}>
							{#if player.isLoading}
								<Loader2 size={16} class="animate-spin text-white" />
							{:else if player.isPlaying}
								<Pause size={16} class="text-white" fill="currentColor" />
							{:else}
								<Play size={16} class="ml-0.5 text-white" fill="currentColor" />
							{/if}
						</div>
					</button>

					<!-- Expand Cover Button -->
					<button
						type="button"
						class="cover-expand-badge"
						onclick={() => player.toggleCoverExpanded()}
						title={player.isCoverExpanded ? 'Minimize artwork' : 'Enlarge artwork'}
						aria-label={player.isCoverExpanded ? 'Minimize artwork' : 'Enlarge artwork'}
					>
						{#if player.isCoverExpanded}
							<Minimize2 size={9} />
						{:else}
							<Maximize2 size={9} />
						{/if}
					</button>
				</div>

				<div class="info">
					<div class="flex items-center gap-1.5 overflow-hidden">
						<a
							class="track-title truncate"
							href={resolve('/app/tracks/[id]', { id: player.currentTrack.id })}
						>
							<strong>{player.currentTrack.title}</strong>
						</a>
						{#if player.qualityLabel}
							<span class="quality-badge">{player.qualityLabel}</span>
						{/if}
					</div>
					<p class="track-artist">
						{#if player.currentTrack.artists.length}
							{#each player.currentTrack.artists as artist, i (artist.id || i)}
								{#if artist.id}
									<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a>
								{:else}
									<span>{artist.name}</span>
								{/if}{#if i < player.currentTrack.artists.length - 1},
								{/if}
							{/each}
						{:else}
							<span>TIDAL Artist</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Section 2: Important Transport Controls (SkipBack, Play/Pause, SkipForward) & Scrubber -->
			<div class="center-playback">
				<div class="transport-controls">
					<button
						type="button"
						class="transport-btn"
						disabled={!player.hasPrevious && player.currentTime < 3}
						onclick={() => player.previous()}
						title={m.player_previous()}
						aria-label={m.player_previous()}
					>
						<SkipBack size={15} />
					</button>

					<button
						type="button"
						class="transport-btn play-pause-btn"
						onclick={() => player.togglePlayPause()}
						title={player.isPlaying ? 'Pause' : 'Play'}
						aria-label={player.isPlaying ? 'Pause' : 'Play'}
					>
						{#if player.isLoading}
							<Loader2 size={16} class="animate-spin" />
						{:else if player.isPlaying}
							<Pause size={16} fill="currentColor" />
						{:else}
							<Play size={16} fill="currentColor" class="ml-0.5" />
						{/if}
					</button>

					<button
						type="button"
						class="transport-btn"
						disabled={!player.hasNext}
						onclick={() => player.next()}
						title={m.player_next()}
						aria-label={m.player_next()}
					>
						<SkipForward size={15} />
					</button>
				</div>

				<!-- Scrubber Bar -->
				<div class="scrubber-wrap">
					<span class="time-readout font-mono">{formatDuration(player.currentTime)}</span>
					<div class="progress-bar-container">
						<input
							type="range"
							min="0"
							max={player.duration || 100}
							step="0.5"
							value={player.currentTime}
							oninput={handleSeek}
							class="scrubber-range"
							aria-label="Seek track"
						/>
						<div
							class="progress-fill"
							style="width: {player.duration > 0
								? (player.currentTime / player.duration) * 100
								: 0}%"
						></div>
					</div>
					<span class="time-readout font-mono">{formatDuration(player.duration)}</span>
				</div>
			</div>

			<!-- Section 3: Important Actions (Volume, Add to Playlist, Queue, External, Expand, Close) -->
			<div class="player-actions">
				<!-- Volume Control -->
				<div class="volume-group">
					<button
						type="button"
						class="action-btn"
						onclick={() => player.toggleMute()}
						title={player.isMuted ? 'Unmute' : 'Mute'}
						aria-label={player.isMuted ? 'Unmute' : 'Mute'}
					>
						{#if player.isMuted || player.volume === 0}
							<VolumeX size={15} />
						{:else}
							<Volume2 size={15} />
						{/if}
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={player.isMuted ? 0 : player.volume}
						oninput={handleVolume}
						class="volume-slider"
						aria-label="Volume"
					/>
				</div>

				<!-- Add to Playlist (+) -->
				<button
					type="button"
					class="action-btn add-btn"
					onclick={() => customPlaylists.promptAddToPlaylist(player.currentTrack!)}
					title="Add to Custom Playlist"
					aria-label="Add to Custom Playlist"
				>
					<Plus size={15} />
				</button>

				<!-- Queue Toggle -->
				<button
					type="button"
					class="action-btn queue-btn"
					class:active={player.isQueueOpen}
					onclick={() => player.toggleQueue()}
					title={m.player_queue()}
					aria-label={m.player_queue()}
				>
					<ListMusic size={15} />
					{#if player.queue.length > 0}
						<span class="queue-counter">{player.queue.length}</span>
					{/if}
				</button>

				<!-- Synchronized Lyrics Toggle -->
				<button
					type="button"
					class="action-btn lyrics-btn"
					class:active={player.isLyricsOpen}
					onclick={() => player.toggleLyrics()}
					title="Synchronized Lyrics"
					aria-label="Synchronized Lyrics"
				>
					<Mic2 size={15} />
				</button>

				<!-- Open in TIDAL Link -->
				<a
					class="action-btn tidal-link"
					href={tidalTrackUrl}
					target="_blank"
					rel="noreferrer"
					title="Open in TIDAL"
					aria-label="Open in TIDAL"
				>
					<ExternalLink size={13} />
				</a>

				<!-- Expand/Collapse Drawer -->
				<button
					type="button"
					class="action-btn expand-btn"
					onclick={() => (player.isExpanded = !player.isExpanded)}
					title={player.isExpanded ? m.player_collapse() : m.player_expand()}
					aria-label={player.isExpanded ? m.player_collapse() : m.player_expand()}
				>
					{#if player.isExpanded}
						<ChevronDown size={16} />
					{:else}
						<ChevronUp size={16} />
					{/if}
				</button>

				<!-- Dismiss Player -->
				<button
					type="button"
					class="action-btn close-btn"
					onclick={() => player.close()}
					title={m.player_close()}
					aria-label={m.player_close()}
				>
					<X size={15} />
				</button>
			</div>
		</div>

		<!-- Expanded Artwork Popover -->
		{#if player.isCoverExpanded}
			<div class="expanded-cover-card">
				<div class="expanded-cover-header">
					<span class="font-mono text-[0.65rem] font-bold tracking-wider text-[var(--action)]">
						SYN // ARTWORK & TELEMETRY
					</span>
					<button
						type="button"
						class="close-expanded-cover"
						onclick={() => player.toggleCoverExpanded()}
						aria-label="Close artwork"
					>
						<X size={14} />
					</button>
				</div>
				<div class="expanded-artwork-wrap">
					{#if player.currentTrack.imageUrl}
						<img class="large-cover" src={player.currentTrack.imageUrl} alt="" />
					{:else if player.currentTrack.album?.imageUrl}
						<img class="large-cover" src={player.currentTrack.album.imageUrl} alt="" />
					{:else}
						<div class="large-cover placeholder-large"><Disc size={48} /></div>
					{/if}
				</div>
				<div class="expanded-meta">
					<strong class="block truncate text-sm font-bold">{player.currentTrack.title}</strong>
					<span class="block truncate text-xs text-[var(--text-muted)]">
						{player.currentTrack.artists.map((a) => a.name).join(', ')}
					</span>
					<div
						class="telemetry-row mt-1.5 flex gap-2 font-mono text-[0.68rem] text-[var(--text-muted)]"
					>
						<span class="telemetry-pill">{player.audioQuality || 'HIGH AAC'}</span>
						<span class="telemetry-pill"
							>{player.playbackMode === 'direct' ? 'NATIVE STREAM' : 'TIDAL EMBED'}</span
						>
					</div>
				</div>
			</div>
		{/if}

		<!-- Live Synchronized Lyrics Drawer -->
		{#if player.isLyricsOpen}
			<div class="lyrics-drawer">
				<div class="lyrics-header">
					<div class="flex items-center gap-2">
						<Mic2 size={16} class="text-[var(--action)]" />
						<span class="text-xs font-bold tracking-wider text-[var(--text-primary)] uppercase">
							Synchronized Lyrics
						</span>
					</div>
					<button
						type="button"
						class="close-expanded-cover"
						onclick={() => player.closeLyrics()}
						aria-label="Close lyrics"
					>
						<X size={14} />
					</button>
				</div>

				<div class="lyrics-body" id="lyrics-scroll-box">
					{#if player.isLyricsLoading}
						<div class="lyrics-status">
							<Loader2 size={22} class="mb-2 animate-spin text-[var(--action)]" />
							<p>Loading synchronized lyrics...</p>
						</div>
					{:else if player.lyricsCues.length > 0}
						<div class="lyrics-cues-list">
							{#each player.lyricsCues as cue, idx (cue.time + '-' + idx)}
								<button
									type="button"
									class="lyric-line-btn"
									class:active={player.activeLyricIndex === idx}
									onclick={() => player.seek(cue.time)}
								>
									<span class="cue-time font-mono">{formatDuration(cue.time)}</span>
									<span class="cue-text">{cue.text}</span>
								</button>
							{/each}
						</div>
					{:else if player.lyrics}
						<div class="plain-lyrics-view">
							{#each player.lyrics.split('\n') as line, idx (idx)}
								<p class="plain-line">{line}</p>
							{/each}
						</div>
					{:else}
						<div class="lyrics-status">
							<p>No lyrics found for this track.</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Expanded Embed Drawer -->
		{#if player.isExpanded}
			<div class="embed-container">
				<iframe
					title={`TIDAL player: ${player.currentTrack.title}`}
					src={tidalEmbedUrl}
					allow="autoplay; encrypted-media"
				></iframe>
			</div>
		{/if}
	{:else}
		<!-- Persistent Idle Dock: Always visible on empty account or before playing -->
		<div class="idle-bar">
			<div class="idle-engine-status">
				<span class="idle-indicator-dot"></span>
				<div class="flex flex-col">
					<span class="font-mono text-xs font-bold tracking-wider text-[var(--text-primary)]">
						SYN // AUDIO ENGINE
					</span>
					<span class="font-mono text-[0.65rem] text-[var(--text-muted)]"
						>READY // NO TRACK LOADED</span
					>
				</div>
			</div>

			<div class="idle-actions">
				<button type="button" class="compose-btn" onclick={() => customPlaylists.openGenerator()}>
					<Sparkles size={14} />
					COMPOSE PLAYLIST
				</button>

				<a class="idle-action-link" href={resolve('/app/search')}>
					<Search size={14} />
					SEARCH
				</a>

				<button
					type="button"
					class="action-btn queue-btn"
					class:active={player.isQueueOpen}
					onclick={() => player.toggleQueue()}
					title={m.player_queue()}
					aria-label={m.player_queue()}
				>
					<ListMusic size={16} />
				</button>
			</div>
		</div>
	{/if}
</aside>

<style>
	.mini-player {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 80;
		width: calc(100% - 2.5rem);
		max-width: 60rem;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-lg, 14px);
		box-shadow:
			0 12px 32px -4px rgba(0, 0, 0, 0.4),
			3px 3px 0px var(--border-strong);
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		transition: all 0.15s ease;
	}

	.idle-dock {
		background: var(--surface-canvas);
		max-width: 50rem;
	}

	.player-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.15rem;
		gap: 1.15rem;
	}

	/* Section 1: Track Meta & Expandable Cover */
	.track-meta {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		min-width: 12rem;
		max-width: 18rem;
		flex: 0 1 auto;
	}

	.cover-container {
		position: relative;
		width: 3.1rem;
		height: 3.1rem;
		flex: 0 0 auto;
	}

	.cover-btn {
		position: relative;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm, 7px);
		background: var(--surface-canvas);
		cursor: pointer;
		overflow: hidden;
		display: block;
	}

	.cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: filter 0.15s ease;
	}

	.cover-btn:hover .cover-img {
		filter: brightness(0.65);
	}

	.cover-placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: var(--text-muted);
	}

	/* Play/Pause Overlay directly on cover */
	.cover-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.45);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.cover-btn:hover .cover-overlay,
	.cover-overlay.force-visible {
		opacity: 1;
	}

	.cover-expand-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		display: grid;
		place-items: center;
		background: var(--action);
		color: var(--action-contrast);
		border: 1px solid var(--border-strong);
		cursor: pointer;
		z-index: 2;
		transition: transform 0.1s ease;
	}

	.cover-expand-badge:hover {
		transform: scale(1.2);
	}

	.info {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.track-title {
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-title:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.quality-badge {
		display: inline-block;
		font-family: var(--font-mono, monospace);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		padding: 1px 4px;
		border-radius: 4px;
		background: var(--surface-sunken);
		color: var(--action);
		border: 1px solid var(--border-subtle);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.track-artist {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.72rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-artist a {
		color: inherit;
		text-decoration: none;
	}

	.track-artist a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	/* Section 2: Center Controls & Scrubber */
	.center-playback {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		flex: 1 1 auto;
		min-width: 14rem;
		max-width: 26rem;
	}

	.transport-controls {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.transport-btn {
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-primary);
		border-radius: var(--radius-sm, 6px);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.transport-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
		background: var(--surface-selected);
		color: var(--action);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.transport-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.play-pause-btn {
		width: 2.35rem;
		height: 2.35rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-md, 8px);
		background: var(--action);
		color: var(--action-contrast);
	}

	.play-pause-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
		color: var(--action-contrast);
	}

	.scrubber-wrap {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
	}

	.time-readout {
		font-size: 0.68rem;
		color: var(--text-muted);
		flex: 0 0 2.4rem;
		text-align: center;
	}

	.progress-bar-container {
		position: relative;
		flex: 1;
		height: 7px;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full, 9999px);
		overflow: hidden;
		display: flex;
		align-items: center;
	}

	.scrubber-range {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		z-index: 2;
		margin: 0;
	}

	.progress-fill {
		height: 100%;
		background: var(--action);
		border-radius: var(--radius-full, 9999px);
		pointer-events: none;
		transition: width 0.1s linear;
	}

	/* Section 3: Actions & Volume */
	.player-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 0 0 auto;
	}

	.volume-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.volume-slider {
		width: 4rem;
		height: 4px;
		accent-color: var(--action);
		cursor: pointer;
		border-radius: var(--radius-full, 9999px);
	}

	.action-btn {
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		color: var(--text-muted);
		border-radius: var(--radius-sm, 6px);
		cursor: pointer;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.action-btn:hover:not(:disabled) {
		color: var(--text-primary);
		border-color: var(--border-strong);
		background: var(--surface-selected);
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.queue-btn {
		position: relative;
	}

	.queue-btn.active,
	.lyrics-btn.active {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}

	.lyrics-drawer {
		position: absolute;
		bottom: calc(100% + 0.85rem);
		right: 1rem;
		width: clamp(18rem, 30vw, 24rem);
		max-height: 26rem;
		display: flex;
		flex-direction: column;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-lg, 14px);
		box-shadow:
			0 16px 36px -6px rgba(0, 0, 0, 0.45),
			3px 3px 0px var(--border-strong);
		animation: slideUp 0.15s ease-out;
		z-index: 90;
		overflow: hidden;
	}

	.lyrics-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
	}

	.lyrics-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.85rem 1rem;
		scroll-behavior: smooth;
	}

	.lyrics-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.lyrics-cues-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.lyric-line-btn {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		text-align: left;
		cursor: pointer;
		color: var(--text-muted);
		font: inherit;
		transition: all 0.15s ease;
	}

	.lyric-line-btn:hover {
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.lyric-line-btn.active {
		background: var(--surface-sunken);
		border-color: var(--action);
		color: var(--text-primary);
		font-weight: 700;
		transform: scale(1.02);
		transform-origin: left center;
	}

	.lyric-line-btn.active .cue-text {
		color: var(--action);
	}

	.cue-time {
		font-size: 0.68rem;
		color: var(--text-muted);
		opacity: 0.7;
		flex-shrink: 0;
	}

	.cue-text {
		font-size: 0.88rem;
		line-height: 1.35;
	}

	.plain-lyrics-view {
		color: var(--text-muted);
		font-size: 0.88rem;
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.plain-line {
		margin-bottom: 0.25rem;
	}

	.queue-counter {
		position: absolute;
		top: -0.3rem;
		right: -0.3rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.2rem;
		background: var(--danger);
		color: #ffffff;
		font-family: ui-monospace, monospace;
		font-size: 0.62rem;
		font-weight: 800;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-full, 9999px);
	}

	/* Expanded Artwork Card */
	.expanded-cover-card {
		position: absolute;
		bottom: calc(100% + 0.85rem);
		left: 1rem;
		width: 17rem;
		padding: 1rem;
		background: var(--surface-raised);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-lg, 14px);
		box-shadow:
			0 16px 36px -6px rgba(0, 0, 0, 0.45),
			3px 3px 0px var(--border-strong);
		animation: slideUp 0.15s ease-out;
		z-index: 90;
	}

	.expanded-cover-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}

	.close-expanded-cover {
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-xs, 4px);
	}

	.close-expanded-cover:hover {
		color: var(--text-primary);
	}

	.expanded-artwork-wrap {
		width: 100%;
		aspect-ratio: 1 / 1;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md, 10px);
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.large-cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.placeholder-large {
		display: grid;
		place-items: center;
		background: var(--surface-canvas);
		color: var(--text-muted);
	}

	.telemetry-pill {
		padding: 0.18rem 0.5rem;
		background: var(--surface-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full, 9999px);
		font-weight: 700;
	}

	/* Idle Bar */
	.idle-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.15rem;
		gap: 0.85rem;
	}

	.idle-engine-status {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.idle-indicator-dot {
		width: 10px;
		height: 10px;
		background: var(--bauhaus-blue);
		border-radius: var(--radius-full, 9999px);
		box-shadow: 0 0 8px var(--bauhaus-blue);
	}

	.idle-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.compose-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.95rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.compose-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.idle-action-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-raised);
		color: var(--text-primary);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		text-decoration: none;
		text-transform: uppercase;
		transition: all 0.12s ease;
	}

	.idle-action-link:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.embed-container {
		border-top: 2px solid var(--border-strong);
		background: var(--surface-canvas);
		border-radius: 0 0 var(--radius-lg, 14px) var(--radius-lg, 14px);
		overflow: hidden;
	}

	.embed-container iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}

	@keyframes slideUp {
		from {
			transform: translate(-50%, 100%);
			opacity: 0;
		}
		to {
			transform: translate(-50%, 0);
			opacity: 1;
		}
	}

	@media (max-width: 48rem) {
		.mini-player {
			bottom: 4.5rem;
			width: calc(100% - 1rem);
		}
		.scrubber-wrap {
			display: none;
		}
		.volume-group {
			display: none;
		}
		.action-btn.tidal-link {
			display: none;
		}
	}

	@media (max-width: 32rem) {
		.idle-engine-status {
			display: none;
		}
		.track-meta {
			min-width: 0;
			max-width: 9rem;
		}
	}
</style>
