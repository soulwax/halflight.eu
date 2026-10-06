<script lang="ts">
	import { getContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { resolve } from '$app/paths';
	import { BadgeInfo, ChevronDown, CirclePlus, Disc, ListMusic, ScrollText } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatReleaseDate } from '#lib/format';
	import { trackArtworkUrl } from '#lib/tidal/artwork';
	import { player } from '#lib/player/player.svelte.js';
	import { customPlaylists } from '#lib/player/customPlaylists.svelte.js';
	import { haptics } from '#lib/player/haptics';
	import PlayerTransport from '#lib/components/player/PlayerTransport.svelte';
	import PlayerSeekBar from '#lib/components/player/PlayerSeekBar.svelte';
	import { nextLyricText } from '#lib/player/lyrics-follow.js';
	import PlaybackStatus from '#lib/components/player/PlaybackStatus.svelte';
	import TrackActionMenu from '#lib/components/music/TrackActionMenu.svelte';
	import { MOBILE_PLAYER_NAVIGATION, type MobilePlayerNavigation } from '#lib/mobile/navigation';
	import {
		EDGE_DRAG_PX,
		dampDrag,
		inferTrackStep,
		lockDragAxis,
		resolveArtworkSwipe,
		swipeWouldCommit,
		type ArtworkSwipe,
		type DragAxis,
		type TrackStep,
		type TrackStepSnapshot
	} from '#lib/mobile/gestures';

	const navigation = getContext<MobilePlayerNavigation | undefined>(MOBILE_PLAYER_NAVIGATION);
	const track = $derived(player.currentTrack);
	const cover = $derived(trackArtworkUrl(track));
	const releaseYear = $derived(formatReleaseDate(track?.album?.releaseDate));
	let erroredTrackId = $state<string | null>(null);
	const showCover = $derived(Boolean(track && cover && erroredTrackId !== track.id));

	// Apple-Music-style resting state: the artwork settles back when paused.
	const isResting = $derived(Boolean(track) && !player.isPlaying && !player.isLoading);

	let reducedMotion = $state(false);
	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reducedMotion = mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});
	const motion = (ms: number) => (reducedMotion ? 0 : ms);

	const lyricsSnippet = $derived.by(() => {
		if (!player.lyrics) return '';
		const lines = player.lyrics
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		return lines.slice(0, 2).join(' · ');
	});

	// Synced lyrics: show the line being sung and a quieter preview of the next.
	const syncedIndex = $derived(player.activeLyricIndex);
	const currentLyric = $derived(
		syncedIndex >= 0 ? player.lyricsCues[syncedIndex]?.text.trim() || '♪' : ''
	);
	const nextLyric = $derived(
		player.lyricsCues.length ? nextLyricText(player.lyricsCues, syncedIndex) : ''
	);

	// --- long titles scroll (Spotify-style) instead of wrapping and eating artwork height ---
	let titleClip = $state<HTMLElement>();
	let titleText = $state<HTMLElement>();
	let titleOverflow = $state(0);
	$effect(() => {
		const clip = titleClip;
		const text = titleText;
		void track?.title;
		if (!clip || !text) return;
		const measure = () => {
			titleOverflow = Math.max(0, Math.ceil(text.scrollWidth - clip.clientWidth));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(clip);
		observer.observe(text);
		return () => observer.disconnect();
	});
	const titleScrolls = $derived(titleOverflow > 2 && !reducedMotion);
	// Each way scrolls at ~45px/s over 38% of the cycle; the rest is two short pauses.
	const marqueeSeconds = $derived(Math.max(8, Math.round(titleOverflow / 45 / 0.38)));

	// --- neighbouring artwork, revealed only while the cover is being dragged sideways ---
	const nextPeek = $derived.by(() => {
		if (!player.canGoNext) return null;
		// Shuffle picks at random, so promise a destination but not a specific cover.
		const upcoming = player.shuffle ? undefined : player.queue[0];
		return { cover: upcoming ? trackArtworkUrl(upcoming) : null };
	});
	const previousPeek = $derived.by(() => {
		// Past three seconds "previous" restarts the song instead of changing it.
		const previous = player.history.at(-1);
		if (!previous || player.currentTime > 3 || player.isPlaybackActiveElsewhere) return null;
		return { cover: trackArtworkUrl(previous) };
	});

	// --- slide new artwork in from the side playback moved to ---
	let stepSnapshot: TrackStepSnapshot = { trackId: null, upcomingIds: [], previousId: null };
	let swipedStep: TrackStep | null = null;
	let enterStep: TrackStep | null = null;
	$effect.pre(() => {
		const trackId = player.currentTrack?.id ?? null;
		if (trackId !== stepSnapshot.trackId) {
			enterStep = swipedStep ?? inferTrackStep(stepSnapshot, trackId);
			swipedStep = null;
		}
		stepSnapshot = {
			trackId,
			upcomingIds: player.queue.map((entry) => entry.id),
			previousId: player.history.at(-1)?.id ?? null
		};
	});

	function artworkIn(_node: Element) {
		const step = enterStep;
		enterStep = null;
		if (reducedMotion) return { duration: 0 };
		if (!step) {
			return {
				duration: 360,
				easing: cubicOut,
				css: (t: number) => `opacity: ${t}; transform: scale(${0.94 + 0.06 * t})`
			};
		}
		const sign = step === 'next' ? 1 : -1;
		return {
			duration: 420,
			easing: cubicOut,
			css: (t: number, u: number) =>
				`opacity: ${0.35 + 0.65 * t}; transform: translateX(calc(${sign * u * 100}% + ${sign * u * 1.5}rem))`
		};
	}

	// --- swipe gestures (enhancement; every action also has a visible control) ---
	let closeLink = $state<HTMLAnchorElement>();
	let dragX = $state(0);
	let sheetY = $state(0);
	let dragAxis = $state<DragAxis | null>(null);
	let closing = $state(false);
	let gesture: {
		id: number;
		x: number;
		y: number;
		t: number;
		axis: DragAxis | null;
		allowTrackSwipe: boolean;
		target: HTMLElement;
		committed: boolean;
	} | null = null;

	function onGestureDown(event: PointerEvent, allowTrackSwipe: boolean) {
		if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
		gesture = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			t: event.timeStamp,
			axis: null,
			allowTrackSwipe,
			target: event.currentTarget as HTMLElement,
			committed: false
		};
	}

	function onGestureMove(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.id) return;
		const dx = event.clientX - gesture.x;
		const dy = event.clientY - gesture.y;
		if (!gesture.axis) {
			const axis = lockDragAxis(dx, dy);
			if (!axis) return;
			// Upward drags and sideways drags outside the artwork are not ours.
			if ((axis === 'x' && !gesture.allowTrackSwipe) || (axis === 'y' && dy < 0)) {
				gesture = null;
				return;
			}
			gesture.axis = axis;
			dragAxis = axis;
			// Capture only once a drag is certain, so a plain tap still reaches links.
			try {
				gesture.target.setPointerCapture(event.pointerId);
			} catch {
				// The pointer already ended; the drag still resolves from the events we get.
			}
		}
		if (gesture.axis === 'x') {
			const blocked = dx < 0 ? !player.canGoNext : !player.canGoPrevious;
			dragX = dampDrag(dx, blocked ? EDGE_DRAG_PX : 120);
		} else {
			sheetY = dampDrag(Math.max(0, dy), 240);
		}
		const committed = swipeWouldCommit(dx, dy, gesture.axis);
		if (committed !== gesture.committed) {
			gesture.committed = committed;
			if (committed) haptics.tick();
		}
	}

	function endGesture(event: PointerEvent, cancelled = false) {
		if (!gesture || event.pointerId !== gesture.id) return;
		const action =
			cancelled || !gesture.axis
				? null
				: resolveArtworkSwipe(
						{
							dx: event.clientX - gesture.x,
							dy: event.clientY - gesture.y,
							durationMs: event.timeStamp - gesture.t
						},
						gesture.axis
					);
		gesture = null;
		dragAxis = null;
		dragX = 0;
		if (action === 'close') {
			// Keep the sheet where the finger left it and let it fade out while we navigate.
			closing = true;
			closeLink?.click();
			// Navigation normally unmounts us first; never leave the sheet stranded.
			setTimeout(() => {
				closing = false;
				sheetY = 0;
			}, 700);
			return;
		}
		sheetY = 0;
		if (action) runSwipe(action);
	}

	function runSwipe(action: Exclude<ArtworkSwipe, 'close'>) {
		const before = player.currentTrack?.id;
		if (action === 'next') {
			if (!player.canGoNext) return;
			swipedStep = 'next';
			player.next();
		} else {
			if (!player.canGoPrevious) return;
			swipedStep = player.history.length && player.currentTime <= 3 ? 'previous' : null;
			player.previous();
		}
		// A swipe that did not change track must not colour the next, unrelated change.
		if (player.currentTrack?.id === before) swipedStep = null;
		haptics.tick();
	}
</script>

<section
	class="now-screen"
	class:has-track={Boolean(track)}
	class:sheet-dragging={dragAxis === 'y'}
	class:closing
	style:--sheet-y="{sheetY}px"
	style:--sheet-progress={Math.min(1, sheetY / 240)}
	aria-labelledby="now-title"
>
	<h1 id="now-title" class="sr-only">{m.now_playing_heading()}</h1>

	{#if track}
		<!-- Ambient backdrop: a blurred wash of the cover, purely decorative. -->
		<div class="now-ambient" aria-hidden="true">
			{#if showCover}
				{#key cover}
					<img src={cover} alt="" draggable="false" transition:fade={{ duration: motion(700) }} />
				{/key}
			{/if}
		</div>
	{/if}

	<!-- Pulling the header down closes the player, like the artwork; the close link is the
	     accessible equivalent. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<header
		class="now-header"
		onpointerdown={(event) => onGestureDown(event, false)}
		onpointermove={onGestureMove}
		onpointerup={(event) => endGesture(event)}
		onpointercancel={(event) => endGesture(event, true)}
	>
		<a
			bind:this={closeLink}
			href={navigation?.returnTo ?? resolve('/(mobile)/home')}
			class="now-icon"
			aria-label={m.now_close_player()}
		>
			<ChevronDown size={26} aria-hidden="true" />
		</a>

		<div class="now-context">
			<span class="now-context-label">{m.player_now_playing()}</span>
			{#if !track?.provenance && track?.album}
				<!-- Like Spotify's "playing from": the context is a way back to its source. -->
				<a
					class="now-context-source"
					href={resolve('/(mobile)/albums/[id]', { id: track.album.id })}>{track.album.title}</a
				>
			{:else}
				<span class="now-context-source">
					{track?.provenance ?? m.now_playing_heading()}
				</span>
			{/if}
		</div>

		{#if track}
			<div class="now-header-actions">
				<TrackActionMenu {track} mobile />
			</div>
		{:else}
			<div class="now-header-spacer" aria-hidden="true"></div>
		{/if}
	</header>

	{#if track}
		<div class="now-content">
			<div
				class="now-artwork-wrap"
				role="presentation"
				onpointerdown={(event) => onGestureDown(event, true)}
				onpointermove={onGestureMove}
				onpointerup={(event) => endGesture(event)}
				onpointercancel={(event) => endGesture(event, true)}
			>
				<div
					class="now-artwork"
					class:resting={isResting}
					class:dragging={dragAxis === 'x'}
					style:--drag-x="{dragX}px"
					style:view-transition-name="syn-now-art"
				>
					{#if dragAxis === 'x'}
						<!-- Neighbouring covers peek in from the side a swipe would go. -->
						{#if previousPeek}
							<div class="now-peek previous" aria-hidden="true">
								{#if previousPeek.cover}
									<img src={previousPeek.cover} alt="" draggable="false" />
								{:else}
									<Disc size={48} />
								{/if}
							</div>
						{/if}
						{#if nextPeek}
							<div class="now-peek next" aria-hidden="true">
								{#if nextPeek.cover}
									<img src={nextPeek.cover} alt="" draggable="false" />
								{:else}
									<Disc size={48} />
								{/if}
							</div>
						{/if}
					{/if}
					{#key track.id}
						<div class="now-artwork-frame" in:artworkIn>
							{#if showCover}
								<img
									src={cover}
									fetchpriority="high"
									draggable="false"
									alt={m.player_cover_alt({ title: track.title })}
									onerror={() => (erroredTrackId = track?.id ?? null)}
								/>
							{:else}
								<Disc size={64} aria-hidden="true" />
							{/if}
						</div>
					{/key}
				</div>
			</div>

			<div class="now-identity">
				<div class="now-title-row">
					<div class="now-title-text">
						<div class="now-title-clip" class:overflowing={titleOverflow > 2} bind:this={titleClip}>
							<p
								class="now-track-title"
								class:marquee={titleScrolls}
								class:paused={!player.isPlaying}
								style:--marquee-shift="{-titleOverflow}px"
								style:--marquee-duration="{marqueeSeconds}s"
								bind:this={titleText}
							>
								{track.title}
							</p>
						</div>
						<p class="now-artists">
							{#each track.artists as artist, index (`${artist.id}-${index}`)}
								{#if index > 0}<span aria-hidden="true">, </span>{/if}
								<a href={resolve('/(mobile)/artists/[id]', { id: artist.id })}>{artist.name}</a>
							{/each}
						</p>
					</div>
					<button
						type="button"
						class="now-add"
						aria-label={m.track_action_add_to_playlist()}
						title={m.track_action_add_to_playlist()}
						onclick={() => customPlaylists.promptAddToPlaylist(track)}
					>
						<CirclePlus size={26} aria-hidden="true" />
					</button>
				</div>
				<div class="now-meta-row">
					{#if track.album}
						<a class="now-album" href={resolve('/(mobile)/albums/[id]', { id: track.album.id })}
							>{track.album.title}{releaseYear ? ` · ${releaseYear}` : ''}</a
						>
					{/if}
					{#if player.qualityLabel}
						<span class="now-quality-tag">{player.qualityLabel}</span>
					{/if}
				</div>
			</div>

			<div class="now-controls">
				<PlaybackStatus mobile />
				<PlayerSeekBar mobile />
				<PlayerTransport mobile />

				<nav class="now-utility-bar" aria-label={m.player_now_playing()}>
					<a
						href={resolve('/(mobile)/tracks/[id]', { id: track.id })}
						class="now-util-btn"
						aria-label={m.track_details_label()}
						title={m.track_details_label()}
					>
						<BadgeInfo size={18} aria-hidden="true" />
						<span class="now-util-label">{m.track_details_label()}</span>
					</a>
					<a
						href={resolve('/(mobile)/now/credits')}
						class="now-util-btn"
						aria-label={m.now_credits_title()}
						title={m.now_credits_title()}
					>
						<ScrollText size={18} aria-hidden="true" />
						<span class="now-util-label">{m.now_credits_title()}</span>
					</a>
					<a
						href={resolve('/(mobile)/now/queue')}
						class="now-util-btn now-queue-btn"
						aria-label={m.now_queue_open()}
						title={m.now_queue_open()}
					>
						<ListMusic size={18} aria-hidden="true" />
						<span class="now-util-label">{m.player_queue()}</span>
						{#if player.queueCount}
							<span class="now-queue-badge">{player.queueCount}</span>
						{/if}
					</a>
				</nav>

				<a
					href={resolve('/(mobile)/now/lyrics')}
					class="now-lyrics-card"
					class:synced={player.lyricsCues.length > 0}
					aria-label={m.now_lyrics_open()}
				>
					<span class="now-lyrics-badge">
						{#if player.lyricsCues.length && player.isPlaying}
							<span class="now-lyrics-live" aria-hidden="true"></span>
						{/if}
						{m.player_lyrics()}
					</span>
					<span class="now-lyrics-lines">
						{#if player.lyricsCues.length}
							{#key currentLyric}
								<span
									class="now-lyrics-preview"
									in:fade={{ duration: motion(220), easing: cubicOut }}>{currentLyric}</span
								>
							{/key}
							{#if nextLyric}
								<span class="now-lyrics-next">{nextLyric}</span>
							{/if}
						{:else if player.lyrics}
							<span class="now-lyrics-preview multi">{lyricsSnippet || m.player_lyrics()}</span>
						{:else if player.isLyricsLoading}
							<span class="now-lyrics-preview muted">{m.now_lyrics_loading()}</span>
						{:else}
							<span class="now-lyrics-preview muted">{m.player_lyrics()}</span>
						{/if}
					</span>
				</a>
			</div>
		</div>
	{:else}
		<div class="now-idle">
			<div class="now-idle-icon-wrap">
				<Disc size={52} aria-hidden="true" />
			</div>
			<p class="now-track-title">{m.now_idle_message()}</p>
			<p class="now-idle-desc">{m.now_idle_description()}</p>
			<div class="now-idle-actions">
				<a href={resolve('/(mobile)/search')} class="now-idle-btn primary">{m.now_idle_search()}</a>
				<a href={resolve('/(mobile)/home')} class="now-idle-btn secondary">{m.now_idle_cta()}</a>
			</div>
		</div>
	{/if}
</section>

<style>
	.now-screen {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 100dvh;
		min-height: 100%;
		box-sizing: border-box;
		padding: calc(0.35rem + env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right))
			calc(0.5rem + env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: none;
		touch-action: manipulation;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		background:
			radial-gradient(
				120% 60% at 50% 0%,
				color-mix(in oklab, var(--action) 22%, transparent),
				transparent 72%
			),
			var(--surface-canvas);
	}

	.now-screen::-webkit-scrollbar {
		display: none;
	}

	/* Ambient cover wash */
	.now-ambient {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}

	.now-ambient img {
		position: absolute;
		inset: -20%;
		width: 140%;
		height: 140%;
		object-fit: cover;
		filter: blur(56px) saturate(1.7);
		opacity: 0.6;
		transform: translateZ(0);
	}

	.now-ambient::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--surface-canvas) 30%, transparent) 0%,
			color-mix(in oklab, var(--surface-canvas) 58%, transparent) 45%,
			color-mix(in oklab, var(--surface-canvas) 88%, transparent) 78%,
			var(--surface-canvas) 100%
		);
	}

	/* Top Bar */
	.now-header {
		display: flex;
		flex: none;
		/* The header is a drag handle for pull-to-close; taps still reach its controls. */
		touch-action: none;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		max-width: 36rem;
		width: 100%;
		margin: 0 auto clamp(0.15rem, 0.8vh, 0.45rem);
	}

	.now-icon {
		display: grid;
		flex: none;
		width: 48px;
		height: 48px;
		margin-inline-start: -0.5rem;
		place-items: center;
		color: var(--text-primary);
		border-radius: var(--radius-full);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color var(--dur-fast) ease,
			transform var(--dur-fast) ease;
	}

	.now-icon:hover {
		background: color-mix(in oklab, var(--text-primary) 10%, transparent);
	}

	.now-icon:active {
		transform: scale(0.92);
	}

	.now-context {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
		text-align: center;
		gap: 0.1rem;
	}

	.now-context-label {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-secondary);
		line-height: 1.1;
	}

	.now-context-source {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 14rem;
		text-decoration: none;
	}

	a.now-context-source:hover,
	a.now-context-source:active {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.now-header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
		margin-inline-end: -0.5rem;
	}

	.now-header-spacer {
		width: 48px;
		height: 48px;
		flex: none;
	}

	/* Main Content Column */
	.now-content {
		display: flex;
		flex-direction: column;
		flex: 1 1 0;
		min-height: 0;
		width: min(100%, 26rem);
		margin: 0 auto;
		justify-content: space-between;
		gap: clamp(0.35rem, 1.2vh, 0.8rem);
	}

	/* Artwork */
	.now-artwork-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 0;
		min-height: 0;
		min-width: 0;
		width: 100%;
		/* Owns horizontal + vertical drags so swipes don't fight page scroll. */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.now-artwork {
		--drag-x: 0px;
		--art-scale: 1;
		position: relative;
		height: 100%;
		max-height: min(100%, 24rem);
		max-width: 100%;
		aspect-ratio: 1;
		min-width: 0;
		min-height: 0;
		transform: translate3d(var(--drag-x), 0, 0) scale(var(--art-scale));
		transition: transform 520ms cubic-bezier(0.34, 1.36, 0.64, 1);
		will-change: transform;
	}

	.now-artwork.resting {
		--art-scale: 0.86;
	}

	.now-artwork.dragging {
		transition: none;
		cursor: grabbing;
	}

	.now-artwork-frame {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: var(--radius-xl);
		color: var(--text-secondary);
		background: color-mix(in oklab, var(--surface-raised) 80%, transparent);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--text-primary) 8%, transparent),
			0 28px 60px -18px rgb(0 0 0 / 0.65),
			0 10px 24px -10px rgb(0 0 0 / 0.45);
		transition: box-shadow 520ms ease;
	}

	.now-artwork.resting .now-artwork-frame {
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--text-primary) 8%, transparent),
			0 14px 30px -16px rgb(0 0 0 / 0.5);
	}

	.now-artwork img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}

	/* Neighbouring covers, one gap away on either side, travelling with the drag. */
	.now-peek {
		position: absolute;
		top: 0;
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-xl);
		color: var(--text-muted);
		background: color-mix(in oklab, var(--surface-raised) 70%, transparent);
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--text-primary) 8%, transparent);
		opacity: 0.72;
		pointer-events: none;
	}

	.now-peek.next {
		left: calc(100% + 1.5rem);
	}

	.now-peek.previous {
		right: calc(100% + 1.5rem);
	}

	/* Pull-to-close: header and content travel together, fading as they go. */
	.now-header,
	.now-content {
		transform: translate3d(0, var(--sheet-y, 0px), 0)
			scale(calc(1 - var(--sheet-progress, 0) * 0.04));
		opacity: calc(1 - var(--sheet-progress, 0) * 0.5);
		transition:
			transform 460ms cubic-bezier(0.34, 1.36, 0.64, 1),
			opacity 300ms ease;
	}

	.now-screen.sheet-dragging .now-header,
	.now-screen.sheet-dragging .now-content {
		transition: none;
	}

	.now-screen.closing .now-header,
	.now-screen.closing .now-content {
		opacity: 0;
		transition: opacity 180ms ease;
	}

	.now-ambient {
		opacity: calc(1 - var(--sheet-progress, 0) * 0.6);
	}

	/* Track Identity */
	.now-identity {
		flex: none;
		min-width: 0;
		width: 100%;
	}

	.now-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.now-title-text {
		flex: 1 1 auto;
		min-width: 0;
	}

	/* One line, like Spotify: a long title scrolls rather than wrapping. */
	.now-title-clip {
		overflow: hidden;
	}

	.now-title-clip.overflowing {
		mask-image: linear-gradient(90deg, #000 calc(100% - 1.75rem), transparent);
	}

	.now-track-title {
		display: inline-block;
		margin: 0;
		font-size: clamp(1.25rem, 4.6vw, 1.6rem);
		font-weight: 750;
		line-height: 1.25;
		letter-spacing: -0.025em;
		color: var(--text-primary);
		white-space: nowrap;
	}

	/* Without motion, a long title ends in an ellipsis instead of scrolling. */
	.now-track-title:not(.marquee) {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: top;
	}

	.now-track-title.marquee {
		animation: now-marquee var(--marquee-duration, 10s) ease-in-out infinite;
	}

	.now-track-title.marquee.paused {
		animation-play-state: paused;
	}

	@keyframes now-marquee {
		0%,
		12% {
			transform: translateX(0);
		}
		50%,
		62% {
			transform: translateX(var(--marquee-shift, 0px));
		}
		100% {
			transform: translateX(0);
		}
	}

	.now-add {
		display: grid;
		flex: none;
		width: 48px;
		height: 48px;
		margin-inline-end: -0.6rem;
		padding: 0;
		place-items: center;
		border: 0;
		border-radius: var(--radius-full);
		background: transparent;
		color: color-mix(in oklab, var(--text-primary) 78%, transparent);
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			color var(--dur-fast) ease,
			background-color var(--dur-fast) ease,
			transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.now-add:hover {
		color: var(--text-primary);
		background: color-mix(in oklab, var(--text-primary) 9%, transparent);
	}

	.now-add:active {
		transform: scale(0.86);
	}

	.now-add:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.now-artists {
		margin: 0.2rem 0 0;
		font-size: var(--fs-md);
		color: color-mix(in oklab, var(--text-primary) 72%, transparent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.now-artists a {
		color: inherit;
		text-decoration: none;
		transition: color var(--dur-fast) ease;
	}

	.now-artists a:hover,
	.now-artists a:active {
		color: var(--text-primary);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.now-meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
		min-width: 0;
	}

	.now-album {
		font-size: var(--fs-xs);
		color: var(--text-muted);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		transition: color var(--dur-fast) ease;
	}

	.now-album:hover,
	.now-album:active {
		color: var(--text-secondary);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.now-quality-tag {
		flex: none;
		font-size: 0.625rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		border: 1px solid color-mix(in oklab, var(--accent-gold) 55%, transparent);
		color: var(--accent-gold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* Controls Area */
	.now-controls {
		display: flex;
		flex-direction: column;
		flex: none;
		gap: clamp(0.15rem, 0.8vh, 0.4rem);
		min-width: 0;
		width: 100%;
	}

	/* Utility Bar */
	.now-utility-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		min-width: 0;
		width: 100%;
	}

	.now-util-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-height: 48px;
		min-width: 48px;
		padding: 0 0.6rem;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: var(--fs-xs);
		font-weight: 600;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			color var(--dur-fast) ease,
			background-color var(--dur-fast) ease,
			transform var(--dur-fast) ease;
	}

	.now-util-btn:first-child {
		margin-inline-start: -0.6rem;
	}

	.now-util-btn:last-child {
		margin-inline-end: -0.6rem;
	}

	.now-util-btn:hover,
	.now-util-btn:active {
		color: var(--text-primary);
		background: color-mix(in oklab, var(--text-primary) 9%, transparent);
	}

	.now-util-btn:active {
		transform: scale(0.95);
	}

	/* Narrow phones: icons only (each link keeps its aria-label), so no label wraps. */
	@media (max-width: 22.4375rem) {
		.now-util-label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	.now-queue-badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.3rem;
		border-radius: var(--radius-full);
		background: var(--action);
		color: var(--action-contrast);
		font-size: 0.625rem;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	/* Lyrics Card */
	.now-lyrics-card {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.55rem 0.9rem 0.6rem;
		border-radius: var(--radius-lg);
		background: color-mix(in oklab, var(--text-primary) 7%, transparent);
		border: 1px solid color-mix(in oklab, var(--text-primary) 9%, transparent);
		backdrop-filter: blur(16px) saturate(1.3);
		-webkit-backdrop-filter: blur(16px) saturate(1.3);
		color: var(--text-primary);
		text-decoration: none;
		min-height: 48px;
		box-sizing: border-box;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color var(--dur-fast) ease,
			transform var(--dur-fast) ease,
			border-color var(--dur-fast) ease;
	}

	.now-lyrics-card:hover {
		background: color-mix(in oklab, var(--text-primary) 11%, transparent);
		border-color: color-mix(in oklab, var(--text-primary) 16%, transparent);
	}

	.now-lyrics-card:active {
		transform: scale(0.985);
	}

	.now-lyrics-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.now-lyrics-live {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--action);
		box-shadow: 0 0 0 0 color-mix(in oklab, var(--action) 60%, transparent);
		animation: lyric-live 1.8s ease-out infinite;
	}

	@keyframes lyric-live {
		70%,
		100% {
			box-shadow: 0 0 0 6px transparent;
		}
	}

	.now-lyrics-lines {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.now-lyrics-preview,
	.now-lyrics-next {
		display: block;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.now-lyrics-preview {
		font-size: 0.9375rem;
		font-weight: 700;
		line-height: 1.3;
		color: var(--text-primary);
	}

	.now-lyrics-preview.multi {
		white-space: normal;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.now-lyrics-preview.muted {
		color: var(--text-secondary);
		font-weight: 600;
	}

	.now-lyrics-next {
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text-muted);
	}

	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Idle State */
	.now-idle {
		display: flex;
		flex: 1 1 0;
		min-height: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		text-align: center;
		color: var(--text-secondary);
		padding: 2rem 1.5rem;
	}

	.now-idle-icon-wrap {
		display: grid;
		place-items: center;
		width: 88px;
		height: 88px;
		border-radius: var(--radius-full);
		background: radial-gradient(
			circle at 30% 30%,
			color-mix(in oklab, var(--action) 26%, transparent),
			color-mix(in oklab, var(--text-primary) 5%, transparent) 70%
		);
		border: 1px solid color-mix(in oklab, var(--text-primary) 10%, transparent);
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.now-idle-desc {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text-secondary);
		max-width: 20rem;
		line-height: 1.45;
	}

	.now-idle-actions {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		width: 100%;
		max-width: 16rem;
		margin-top: 0.5rem;
	}

	.now-idle-actions a {
		display: grid;
		min-height: 48px;
		padding: 0.6rem 1.25rem;
		place-items: center;
		border-radius: var(--radius-full);
		text-decoration: none;
		font-weight: 700;
		font-size: var(--fs-sm);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform var(--dur-fast) ease,
			opacity var(--dur-fast) ease;
	}

	.now-idle-actions a:active {
		transform: scale(0.97);
	}

	.now-idle-actions a:first-child {
		color: var(--action-contrast);
		background: var(--action);
	}

	.now-idle-actions a:last-child {
		color: var(--text-primary);
		background: color-mix(in oklab, var(--text-primary) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--text-primary) 12%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.now-artwork,
		.now-artwork-frame,
		.now-header,
		.now-content {
			transition: none;
		}

		.now-lyrics-live {
			animation: none;
		}
	}

	@media (prefers-reduced-transparency: reduce) {
		.now-ambient img {
			display: none;
		}

		.now-lyrics-card {
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			background: var(--surface-raised);
		}
	}

	/* Landscape Responsive Grid */
	@media (orientation: landscape) and (max-height: 34rem),
		(min-width: 40rem) and (max-height: 34rem) {
		.now-screen {
			padding: calc(0.2rem + env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
				calc(0.25rem + env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
		}

		.now-header {
			margin: 0 auto 0.15rem;
		}

		.now-header .now-icon,
		.now-header .now-header-spacer {
			width: 38px;
			height: 38px;
		}

		.now-context-label {
			font-size: 0.5625rem;
		}

		.now-context-source {
			font-size: 0.75rem;
			max-width: 12rem;
		}

		.now-content {
			display: grid;
			grid-template-columns: minmax(7rem, 0.7fr) minmax(14rem, 1.3fr);
			grid-template-rows: auto 1fr;
			align-items: center;
			column-gap: 1.25rem;
			row-gap: 0.2rem;
			width: min(100%, 52rem);
			height: 100%;
			flex: 1 1 0;
			min-height: 0;
		}

		.now-artwork-wrap {
			grid-column: 1;
			grid-row: 1 / 3;
			height: 100%;
			max-height: 100%;
			padding: 0;
			display: grid;
			place-items: center;
		}

		.now-artwork {
			max-height: min(100%, 55dvh);
			max-width: min(100%, 55dvh);
			width: 100%;
			height: auto;
		}

		.now-identity {
			grid-column: 2;
			grid-row: 1;
			margin-bottom: 0;
		}

		.now-track-title {
			font-size: 1.05rem;
			line-height: 1.2;
		}

		.now-add {
			width: 40px;
			height: 40px;
		}

		.now-artists {
			font-size: 0.8125rem;
			line-height: 1.15;
			margin-top: 0.1rem;
		}

		.now-meta-row {
			margin-top: 0.1rem;
			font-size: 0.6875rem;
		}

		.now-controls {
			grid-column: 2;
			grid-row: 2;
			gap: 0.125rem;
		}

		.now-util-btn {
			min-height: 32px;
			padding: 0 0.35rem;
			font-size: 0.6875rem;
			gap: 0.25rem;
		}

		.now-util-btn:first-child,
		.now-util-btn:last-child {
			margin-inline: 0;
		}

		.now-lyrics-card {
			flex-direction: row;
			align-items: center;
			min-height: 28px;
			padding: 0.2rem 0.6rem;
			gap: 0.5rem;
			margin-top: 0.05rem;
		}

		.now-lyrics-badge {
			flex: none;
			font-size: 0.5625rem;
		}

		.now-lyrics-preview,
		.now-lyrics-preview.multi {
			display: block;
			white-space: nowrap;
			font-size: 0.75rem;
			line-height: 1.2;
		}

		.now-lyrics-next {
			display: none;
		}
	}
</style>
