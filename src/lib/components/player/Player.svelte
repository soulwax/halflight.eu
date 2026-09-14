<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Play, SkipBack, SkipForward } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import { handlePlayerKeydown } from '#lib/player/shortcuts.js';
	import PlayerSeekBar from './PlayerSeekBar.svelte';
	import NowPlaying from './NowPlaying.svelte';
	import PlayerTransport from './PlayerTransport.svelte';
	import PlayerActions from './PlayerActions.svelte';
	import PlayerPanel from './PlayerPanel.svelte';
	import './player.css';

	const tidalUrl = $derived(
		player.currentTrack
			? `https://tidal.com/browse/track/${encodeURIComponent(player.currentTrack.id)}`
			: ''
	);

	let isNarrow = $state(false);
	$effect(() => {
		const mq = window.matchMedia('(max-width: 48rem)');
		const sync = () => (isNarrow = mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});
	const floating = $derived(player.dockMode === 'floating' && !isNarrow);

	// --- floating-window drag ---
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
		player.dragTo(
			event.clientX,
			event.clientY,
			dragOffset.x,
			dragOffset.y,
			window.innerWidth,
			window.innerHeight
		);
	}
	function endDrag(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		player.setFloatingPos(player.floatingPos.x, player.floatingPos.y);
		(event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
	}

	// --- listening room keyboard shortcuts ---
	function onKeydown(event: KeyboardEvent) {
		handlePlayerKeydown(event, {
			hasTrack: Boolean(player.currentTrack),
			togglePlayPause: () => player.togglePlayPause(),
			seekBy: (sec) => player.seekBy(sec),
			adjustVolume: (delta) => player.adjustVolume(delta),
			setVolume: (vol) => player.setVolume(vol),
			toggleMute: () => player.toggleMute(),
			next: () => player.next(),
			previous: () => player.previous(),
			togglePanel: (panel) => player.openPanel(panel),
			toggleDock: () => player.toggleDock()
		});
	}
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
		<div class="bar">
			<NowPlaying {track} />
			<div class="player-center">
				<PlayerTransport />
				<PlayerSeekBar />
			</div>
			<PlayerActions {track} {floating} {isNarrow} {tidalUrl} />
		</div>
		{#if player.isPlaybackActiveElsewhere}
			<div class="player-sync-status" role="status">
				<span>{m.now_playing_elsewhere()}</span>
				<button
					class="player-sync-action"
					type="button"
					disabled={player.playbackClaimPending}
					onclick={() => player.playHere()}
				>
					{m.now_play_here()}
				</button>
			</div>
		{/if}
		{#if player.persistenceStatus === 'conflict'}
			<div class="player-sync-status" role="status">
				<span>{m.player_sync_conflict()}</span>
				<button
					class="player-sync-action"
					type="button"
					onclick={() => player.refreshQueueFromServer()}
				>
					{m.player_sync_refresh()}
				</button>
			</div>
		{:else if player.persistenceStatus === 'offline'}
			<p class="player-sync-status" role="status">{m.player_sync_offline()}</p>
		{:else if player.persistenceStatus === 'rejected'}
			<p class="player-sync-status" role="status">{m.player_sync_rejected()}</p>
		{:else if player.persistenceStatus === 'unauthenticated'}
			<div class="player-sync-status" role="status">
				<span>{m.player_sync_unauthenticated()}</span>
				<a class="player-sync-action" href="/sign-in">{m.sign_in_button()}</a>
			</div>
		{/if}

		{#if player.isExpanded}
			<PlayerPanel {track} {floating} onDragStart={startDrag} />
		{/if}
	</section>
{:else}
	<section class="syn-player idle" aria-label={m.player_now_playing()}>
		<div class="bar">
			<div class="identity">
				<span class="cover cover-idle" aria-hidden="true">
					<span class="cover-fallback"><Disc size={18} /></span>
				</span>
				<div class="meta">
					<span class="title title-idle">{m.player_idle()}</span>
					<span class="sub">
						<a class="idle-cta" href={resolve('/app/search')}>{m.player_idle_cta()}</a>
					</span>
				</div>
			</div>
			<div class="player-center">
				<div class="transport">
					<button type="button" class="t-btn" disabled aria-label={m.player_previous()}>
						<SkipBack size={18} />
					</button>
					<button type="button" class="t-btn play" disabled aria-label={m.player_play_track()}>
						<Play size={19} fill="currentColor" />
					</button>
					<button type="button" class="t-btn" disabled aria-label={m.player_next()}>
						<SkipForward size={18} />
					</button>
				</div>
				<div class="seek" aria-hidden="true">
					<span class="time">0:00</span>
					<div class="seek-track"><span class="seek-fill" style="width:0"></span></div>
					<span class="time">0:00</span>
				</div>
			</div>
			<div class="actions"></div>
		</div>
	</section>
{/if}
