<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
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
		<PlayerSeekBar />

		<div class="bar">
			<NowPlaying {track} />
			<PlayerTransport />
			<PlayerActions {track} {floating} {isNarrow} {tidalUrl} />
		</div>

		{#if player.isExpanded}
			<PlayerPanel {track} {floating} onDragStart={startDrag} />
		{/if}
	</section>
{:else}
	<section class="syn-player idle" aria-label={m.player_now_playing()}>
		<span class="idle-dot"></span>
		<span class="idle-text">{m.player_idle()}</span>
		<a class="idle-cta" href={resolve('/app/search')}>{m.nav_search()}</a>
	</section>
{/if}
