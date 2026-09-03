<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { player } from '#lib/player/player.svelte.js';
	import { resolve } from '$app/paths';
	import {
		ArrowDown,
		ArrowUp,
		ChevronDown,
		ChevronUp,
		Disc,
		ExternalLink,
		ListMusic,
		Loader2,
		Mic2,
		Move,
		Pause,
		PictureInPicture2,
		Play,
		Plus,
		Radio,
		Repeat,
		Repeat1,
		Shuffle,
		SkipBack,
		SkipForward,
		Trash2,
		Volume2,
		VolumeX,
		X
	} from '@lucide/svelte';

	const embedUrl = $derived(
		player.currentTrack
			? `https://embed.tidal.com/tracks/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);
	const tidalUrl = $derived(
		player.currentTrack
			? `https://tidal.com/browse/track/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);
	const cover = $derived(
		player.currentTrack?.imageUrl ?? player.currentTrack?.album?.imageUrl ?? null
	);
	const artistLine = $derived(player.currentTrack?.artists.map((a) => a.name).join(', ') ?? '');

	let isNarrow = $state(false);
	$effect(() => {
		const mq = window.matchMedia('(max-width: 48rem)');
		const sync = () => (isNarrow = mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});
	const floating = $derived(player.dockMode === 'floating' && !isNarrow);

	function fmt(seconds: number): string {
		if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
		const m = Math.floor(seconds / 60);
		return `${m}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
	}

	// --- drag (floating mode) --------------------------------------------------
	let dragging = $state(false);
	let dragOffset = { x: 0, y: 0 };

	function startDrag(event: PointerEvent) {
		if (!floating) return;
		dragging = true;
		dragOffset = {
			x: event.clientX - player.floatingPos.x,
			y: event.clientY - player.floatingPos.y
		};
		(event.target as HTMLElement).setPointerCapture(event.pointerId);
	}
	function onDrag(event: PointerEvent) {
		if (!dragging) return;
		const w = 380;
		const h = player.isExpanded ? 460 : 92;
		const x = Math.min(Math.max(8, event.clientX - dragOffset.x), window.innerWidth - w - 8);
		const y = Math.min(Math.max(8, event.clientY - dragOffset.y), window.innerHeight - h - 8);
		player.floatingPos = { x, y };
	}
	function endDrag(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		player.setFloatingPos(player.floatingPos.x, player.floatingPos.y);
		(event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
	}

	// --- keyboard: Space toggles play when nothing text-editable is focused ---
	function onKeydown(event: KeyboardEvent) {
		if (event.code !== 'Space' || !player.currentTrack) return;
		const el = document.activeElement;
		const editable =
			el instanceof HTMLElement &&
			(el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName));
		if (editable) return;
		event.preventDefault();
		player.togglePlayPause();
	}

	function saveQueue() {
		const tracks = player.currentTrack ? [player.currentTrack, ...player.queue] : [...player.queue];
		if (!tracks.length) return;
		customPlaylists.createPlaylist(
			`${m.player_queue()} — ${new Date().toLocaleDateString()}`,
			m.player_save_queue(),
			tracks
		);
	}

	const RepeatIcon = $derived(player.repeatMode === 'one' ? Repeat1 : Repeat);
</script>

<svelte:window
	onkeydown={onKeydown}
	onpointermove={onDrag}
	onpointerup={endDrag}
	onpointercancel={endDrag}
/>

{#if player.currentTrack}
	{@const track = player.currentTrack}
	<section
		class="syn-player"
		class:floating
		class:expanded={player.isExpanded}
		class:dragging
		style={floating ? `left:${player.floatingPos.x}px;top:${player.floatingPos.y}px` : ''}
		aria-label={m.player_now_playing()}
	>
		<!-- seek -->
		<div class="seek">
			<span class="time">{fmt(player.currentTime)}</span>
			<div class="seek-track">
				<input
					type="range"
					min="0"
					max={player.duration || 100}
					step="0.5"
					value={player.currentTime}
					oninput={(e) => player.seek(parseFloat(e.currentTarget.value))}
					aria-label="Seek"
				/>
				<span
					class="seek-fill"
					style="width:{player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0}%"
				></span>
			</div>
			<span class="time">{fmt(player.duration)}</span>
		</div>

		<div class="bar">
			<!-- identity -->
			<div class="identity">
				<button
					type="button"
					class="cover"
					class:spin={player.isPlaying && !player.isLoading}
					onclick={() => player.togglePlayPause()}
					aria-label={player.isPlaying ? m.player_collapse() : m.player_play_track()}
				>
					{#if cover}
						<img src={cover} alt="" />
					{:else}
						<span class="cover-fallback"><Disc size={18} /></span>
					{/if}
					<span class="cover-cta">
						{#if player.isLoading}
							<Loader2 size={15} class="animate-spin" />
						{:else if player.isPlaying}
							<Pause size={15} fill="currentColor" />
						{:else}
							<Play size={15} fill="currentColor" />
						{/if}
					</span>
				</button>
				<div class="meta">
					<a class="title" href={resolve('/app/tracks/[id]', { id: track.id })}>{track.title}</a>
					<span class="sub">
						{#if artistLine}<span class="artists">{artistLine}</span>{/if}
						{#if player.qualityLabel}<span class="badge">{player.qualityLabel}</span>{/if}
						{#if player.playbackMode === 'embed'}<span class="badge badge-embed">TIDAL</span>{/if}
					</span>
				</div>
			</div>

			<!-- transport -->
			<div class="transport">
				<button
					type="button"
					class="t-btn"
					class:on={player.shuffle}
					onclick={() => player.toggleShuffle()}
					aria-pressed={player.shuffle}
					title={m.player_shuffle()}
					aria-label={m.player_shuffle()}
				>
					<Shuffle size={15} />
				</button>
				<button
					type="button"
					class="t-btn"
					disabled={!player.hasPrevious && player.currentTime < 3}
					onclick={() => player.previous()}
					title={m.player_previous()}
					aria-label={m.player_previous()}
				>
					<SkipBack size={16} />
				</button>
				<button
					type="button"
					class="t-btn play"
					onclick={() => player.togglePlayPause()}
					title={player.isPlaying ? m.player_collapse() : m.player_play_track()}
					aria-label={player.isPlaying ? m.player_collapse() : m.player_play_track()}
				>
					{#if player.isLoading}
						<Loader2 size={17} class="animate-spin" />
					{:else if player.isPlaying}
						<Pause size={17} fill="currentColor" />
					{:else}
						<Play size={17} fill="currentColor" />
					{/if}
				</button>
				<button
					type="button"
					class="t-btn"
					disabled={!player.hasNext && player.repeatMode === 'off'}
					onclick={() => player.next()}
					title={m.player_next()}
					aria-label={m.player_next()}
				>
					<SkipForward size={16} />
				</button>
				<button
					type="button"
					class="t-btn"
					class:on={player.repeatMode !== 'off'}
					onclick={() => player.cycleRepeat()}
					title={m.player_repeat()}
					aria-label={m.player_repeat()}
				>
					<RepeatIcon size={15} />
				</button>
			</div>

			<!-- actions -->
			<div class="actions">
				{#if !isNarrow}
					<div class="vol">
						<button
							type="button"
							class="a-btn"
							onclick={() => player.toggleMute()}
							aria-label={m.player_volume()}
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
							step="0.02"
							value={player.isMuted ? 0 : player.volume}
							oninput={(e) => player.setVolume(parseFloat(e.currentTarget.value))}
							aria-label={m.player_volume()}
						/>
					</div>
				{/if}

				<button
					type="button"
					class="a-btn"
					onclick={() => customPlaylists.promptAddToPlaylist(track)}
					title={m.player_add_to_playlist()}
					aria-label={m.player_add_to_playlist()}
				>
					<Plus size={15} />
				</button>
				<button
					type="button"
					class="a-btn"
					class:on={player.isExpanded && player.panel === 'queue'}
					onclick={() => player.openPanel('queue')}
					title={m.player_queue()}
					aria-label={m.player_queue()}
				>
					<ListMusic size={15} />
					{#if player.queueCount > 0}<span class="count">{player.queueCount}</span>{/if}
				</button>
				<button
					type="button"
					class="a-btn"
					class:on={player.isExpanded && player.panel === 'lyrics'}
					onclick={() => player.openPanel('lyrics')}
					title={m.player_lyrics()}
					aria-label={m.player_lyrics()}
				>
					<Mic2 size={15} />
				</button>
				{#if !isNarrow}
					<button
						type="button"
						class="a-btn"
						onclick={() => player.toggleDock()}
						title={floating ? m.player_dock() : m.player_undock()}
						aria-label={floating ? m.player_dock() : m.player_undock()}
					>
						<PictureInPicture2 size={15} />
					</button>
				{/if}
				<a
					class="a-btn"
					href={tidalUrl}
					target="_blank"
					rel="noreferrer"
					title={m.player_open_tidal()}
					aria-label={m.player_open_tidal()}
				>
					<ExternalLink size={13} />
				</a>
				<button
					type="button"
					class="a-btn"
					onclick={() => player.toggleExpanded()}
					title={player.isExpanded ? m.player_collapse() : m.player_expand()}
					aria-label={player.isExpanded ? m.player_collapse() : m.player_expand()}
				>
					{#if player.isExpanded}<ChevronDown size={16} />{:else}<ChevronUp size={16} />{/if}
				</button>
				<button
					type="button"
					class="a-btn"
					onclick={() => player.close()}
					title={m.player_close()}
					aria-label={m.player_close()}
				>
					<X size={15} />
				</button>
			</div>
		</div>

		{#if player.isExpanded}
			<div class="panel">
				{#if floating}
					<button
						type="button"
						class="drag-handle"
						onpointerdown={startDrag}
						aria-label={m.player_undock()}
					>
						<Move size={13} />
					</button>
				{/if}

				<div class="tabs" role="tablist">
					<button
						role="tab"
						aria-selected={player.panel === 'queue'}
						class:on={player.panel === 'queue'}
						onclick={() => (player.panel = 'queue')}
					>
						<ListMusic size={13} />
						{m.player_queue()}
						{#if player.queueCount}<span class="tab-count">{player.queueCount}</span>{/if}
					</button>
					<button
						role="tab"
						aria-selected={player.panel === 'lyrics'}
						class:on={player.panel === 'lyrics'}
						onclick={() => player.openPanel('lyrics')}
					>
						<Mic2 size={13} />
						{m.player_lyrics()}
					</button>
					<button
						role="tab"
						aria-selected={player.panel === 'source'}
						class:on={player.panel === 'source'}
						onclick={() => (player.panel = 'source')}
					>
						<Radio size={13} />
						{m.player_source()}
					</button>
				</div>

				<div class="panel-body">
					{#if player.panel === 'queue'}
						<div class="queue-toolbar">
							<span class="q-label">{m.player_next_up()}</span>
							<div class="q-tools">
								{#if player.queueCount || player.currentTrack}
									<button type="button" onclick={saveQueue}>{m.player_save_queue()}</button>
								{/if}
								{#if player.queueCount}
									<button type="button" onclick={() => player.clearQueue()}>
										{m.player_clear_queue()}
									</button>
								{/if}
							</div>
						</div>
						{#if player.queue.length === 0}
							<p class="empty">{m.player_queue_empty()}</p>
						{:else}
							<ol class="queue">
								{#each player.queue as qt, i (qt.id + '-' + i)}
									<li>
										<button
											type="button"
											class="q-play"
											onclick={() => player.playFromQueue(i)}
											title={m.player_play_track()}
										>
											{#if qt.imageUrl || qt.album?.imageUrl}
												<img src={qt.imageUrl ?? qt.album?.imageUrl} alt="" />
											{:else}
												<span class="q-thumb"><Disc size={14} /></span>
											{/if}
											<span class="q-meta">
												<span class="q-title">{qt.title}</span>
												<span class="q-artist">{qt.artists.map((a) => a.name).join(', ')}</span>
											</span>
										</button>
										<div class="q-actions">
											<button
												type="button"
												disabled={i === 0}
												onclick={() => player.moveQueueItem(i, -1)}
												aria-label={m.player_move_up()}><ArrowUp size={13} /></button
											>
											<button
												type="button"
												disabled={i === player.queue.length - 1}
												onclick={() => player.moveQueueItem(i, 1)}
												aria-label={m.player_move_down()}><ArrowDown size={13} /></button
											>
											<button
												type="button"
												onclick={() => player.removeFromQueue(i)}
												aria-label={m.player_remove_from_queue()}><Trash2 size={13} /></button
											>
										</div>
									</li>
								{/each}
							</ol>
						{/if}
					{:else if player.panel === 'lyrics'}
						{#if player.isLyricsLoading}
							<div class="lyr-status"><Loader2 size={20} class="animate-spin" /></div>
						{:else if player.lyricsCues.length}
							<div class="lyr-cues">
								{#each player.lyricsCues as cue, i (cue.time + '-' + i)}
									<button
										type="button"
										class="lyr-line"
										class:active={player.activeLyricIndex === i}
										onclick={() => player.seek(cue.time)}
									>
										{cue.text || '♪'}
									</button>
								{/each}
							</div>
						{:else if player.lyrics}
							<div class="lyr-plain">
								{#each player.lyrics.split('\n') as line, i (i)}<p>{line || ' '}</p>{/each}
							</div>
						{:else}
							<p class="empty">{m.player_no_lyrics()}</p>
						{/if}
					{:else}
						<div class="source">
							{#if player.playbackMode === 'embed'}
								<p class="source-note">
									{#if player.requiresFullAuth}
										{m.player_source_preview()}
										<a href={resolve('/app/settings/tidal')}>{m.player_source_link()}</a>
									{:else}
										{m.player_source_tidal()}
									{/if}
								</p>
							{/if}
							<iframe
								title={`TIDAL — ${track.title}`}
								src={embedUrl}
								allow="autoplay; encrypted-media"
							></iframe>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</section>
{:else}
	<section class="syn-player idle" aria-label={m.player_now_playing()}>
		<span class="idle-dot"></span>
		<span class="idle-text">{m.player_idle()}</span>
		<a class="idle-cta" href={resolve('/app/search')}>{m.nav_search()}</a>
	</section>
{/if}

<style>
	.syn-player {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		background: var(--surface-raised);
		border-top: 1px solid var(--border-subtle);
		box-shadow:
			0 -1px 0 0 color-mix(in oklab, var(--accent-gold) 16%, transparent),
			0 -18px 44px -28px rgba(0, 0, 0, 0.7);
	}

	.syn-player.floating {
		right: auto;
		bottom: auto;
		width: 380px;
		border: 1px solid var(--border-subtle);
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, var(--accent-gold) 14%, transparent),
			0 24px 60px -20px rgba(0, 0, 0, 0.75);
	}
	.syn-player.floating.dragging {
		user-select: none;
		cursor: grabbing;
	}

	.syn-player.idle {
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 1.15rem;
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.idle-dot {
		width: 6px;
		height: 6px;
		rotate: 45deg;
		background: var(--accent-gold-deep);
	}
	.idle-text {
		flex: 1;
	}
	.idle-cta {
		color: var(--accent-gold);
		text-decoration: none;
		font-weight: 700;
	}

	/* seek */
	.seek {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.3rem 1rem 0;
	}
	.floating .seek {
		padding: 0.5rem 0.9rem 0;
	}
	.time {
		font-variant-numeric: tabular-nums;
		font-size: 0.66rem;
		color: var(--text-muted);
		min-width: 2.6rem;
		text-align: center;
	}
	.seek-track {
		position: relative;
		flex: 1;
		height: 14px;
		display: flex;
		align-items: center;
	}
	.seek-track input {
		appearance: none;
		width: 100%;
		height: 3px;
		margin: 0;
		background: var(--border-subtle);
		cursor: pointer;
	}
	.seek-fill {
		position: absolute;
		left: 0;
		height: 3px;
		background: var(--accent-gold);
		pointer-events: none;
	}
	.seek-track input::-webkit-slider-thumb {
		appearance: none;
		width: 11px;
		height: 11px;
		rotate: 45deg;
		background: var(--accent-gold);
		border: 0;
	}
	.seek-track input::-moz-range-thumb {
		width: 10px;
		height: 10px;
		border-radius: 0;
		background: var(--accent-gold);
		border: 0;
	}

	/* bar */
	.bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 1rem 0.7rem;
	}
	.floating .bar {
		grid-template-columns: 1fr;
		justify-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem 0.8rem;
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.floating .identity {
		width: 100%;
	}
	.cover {
		position: relative;
		flex: 0 0 auto;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: 1px solid var(--border-subtle);
		background: var(--surface-selected);
		cursor: pointer;
		overflow: hidden;
	}
	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cover-fallback {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: var(--text-muted);
	}
	.cover.spin::after {
		content: '';
		position: absolute;
		inset: -1px;
		border: 1px solid transparent;
		border-top-color: var(--accent-gold);
		animation: spin 3s linear infinite;
	}
	.cover-cta {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		opacity: 0;
		transition: opacity 0.14s ease;
	}
	.cover:hover .cover-cta,
	.cover:focus-visible .cover-cta {
		opacity: 1;
	}

	.meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.floating .meta {
		align-items: center;
		text-align: center;
	}
	.title {
		font-family: var(--font-display);
		font-size: 0.98rem;
		color: var(--text-primary);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title:hover {
		color: var(--accent-gold);
	}
	.sub {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.artists {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.badge {
		flex: 0 0 auto;
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--border-subtle);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent-gold-deep);
	}
	.badge-embed {
		color: var(--accent-jade);
		border-color: color-mix(in oklab, var(--accent-jade) 40%, transparent);
	}

	.transport {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.t-btn,
	.a-btn {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 0.14s ease,
			border-color 0.14s ease,
			background-color 0.14s ease;
	}
	.t-btn:hover,
	.a-btn:hover {
		color: var(--text-primary);
		background: var(--surface-selected);
	}
	.t-btn:disabled,
	.a-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.t-btn.on,
	.a-btn.on {
		color: var(--accent-gold);
		border-color: color-mix(in oklab, var(--accent-gold) 35%, transparent);
	}
	.t-btn.play {
		width: 2.5rem;
		height: 2.5rem;
		color: var(--action-contrast);
		background: var(--accent-gold);
		border-color: var(--accent-gold-deep);
	}
	.t-btn.play:hover {
		background: var(--accent-gold);
		filter: brightness(1.06);
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.15rem;
	}
	.floating .actions {
		flex-wrap: wrap;
		justify-content: center;
	}
	.a-btn .count {
		position: absolute;
		top: -1px;
		right: -1px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		display: grid;
		place-items: center;
		background: var(--accent-gold);
		color: var(--action-contrast);
		font-size: 0.58rem;
		font-weight: 700;
	}
	.vol {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.vol input {
		width: 5rem;
		height: 3px;
		accent-color: var(--accent-gold);
	}

	/* panel */
	.panel {
		position: relative;
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-canvas);
		max-height: 24rem;
		display: flex;
		flex-direction: column;
	}
	.floating .panel {
		max-height: 22rem;
	}
	.drag-handle {
		position: absolute;
		top: 0.35rem;
		right: 0.4rem;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: grab;
	}
	.drag-handle:active {
		cursor: grabbing;
	}

	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.tabs button {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.7rem 1rem;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.tabs button.on {
		color: var(--text-primary);
		border-bottom-color: var(--accent-gold);
	}
	.tab-count {
		padding: 0 0.3rem;
		background: var(--surface-selected);
		font-size: 0.6rem;
	}

	.panel-body {
		overflow-y: auto;
		padding: 0.6rem;
	}
	.empty {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.queue-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.3rem 0.4rem 0.6rem;
	}
	.q-label {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.q-tools {
		display: flex;
		gap: 0.4rem;
	}
	.q-tools button {
		border: 1px solid var(--border-subtle);
		background: transparent;
		padding: 0.25rem 0.6rem;
		color: var(--text-muted);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.q-tools button:hover {
		color: var(--accent-gold);
		border-color: var(--accent-gold-deep);
	}

	.queue {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.queue li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border-top: 1px solid var(--border-subtle);
	}
	.queue li:first-child {
		border-top: 0;
	}
	.q-play {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		padding: 0.5rem 0.4rem;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.q-play img,
	.q-thumb {
		flex: 0 0 auto;
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		background: var(--surface-selected);
	}
	.q-thumb {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}
	.q-meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.q-title {
		font-size: 0.82rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.q-artist {
		font-size: 0.68rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.q-play:hover .q-title {
		color: var(--accent-gold);
	}
	.q-actions {
		display: flex;
		gap: 0;
		padding-right: 0.3rem;
	}
	.q-actions button {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.q-actions button:hover:not(:disabled) {
		color: var(--accent-gold);
	}
	.q-actions button:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.lyr-status {
		display: grid;
		place-items: center;
		padding: 2rem;
		color: var(--accent-gold);
	}
	.lyr-cues {
		display: flex;
		flex-direction: column;
	}
	.lyr-line {
		border: 0;
		background: transparent;
		padding: 0.35rem 0.6rem;
		text-align: left;
		color: var(--text-muted);
		font-size: 0.92rem;
		line-height: 1.5;
		cursor: pointer;
	}
	.lyr-line.active {
		color: var(--accent-gold);
		font-weight: 600;
	}
	.lyr-plain p {
		margin: 0;
		padding: 0.15rem 0.6rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.source {
		display: flex;
		flex-direction: column;
	}
	.source-note {
		margin: 0;
		padding: 0.5rem 0.6rem;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.source-note a {
		color: var(--accent-gold);
		font-weight: 700;
	}
	.source iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}

	/* mobile */
	@media (max-width: 48rem) {
		.bar {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.5rem;
			padding: 0.4rem 0.7rem 0.6rem;
		}
		.transport {
			gap: 0.1rem;
		}
		.transport .t-btn:first-child,
		.transport .t-btn:last-child {
			display: none;
		}
		.actions {
			display: none;
		}
		.identity {
			grid-column: 1;
		}
		.transport {
			grid-column: 2;
		}
		.syn-player.expanded .panel {
			position: fixed;
			inset: 0 0 auto 0;
			height: 100dvh;
			max-height: none;
		}
		.syn-player.expanded {
			height: 100dvh;
		}
		.panel-body {
			flex: 1;
		}
		.t-btn,
		.a-btn {
			width: 2.4rem;
			height: 2.4rem;
		}
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cover.spin::after {
			animation: none;
		}
	}
</style>
