<script lang="ts">
	import { player } from '#lib/player/player.svelte.js';
	import PlaybackStatus from '#lib/components/player/PlaybackStatus.svelte';
	import SessionSaveStatus from '#lib/components/player/SessionSaveStatus.svelte';

	let {
		includePlayback = true,
		includeQueueSync = true
	}: { includePlayback?: boolean; includeQueueSync?: boolean } = $props();
	const playbackNeedsAttention = $derived(
		player.isPlaybackActiveElsewhere ||
			Boolean(
				player.currentTrack &&
				(player.resumeStatus === 'unavailable' ||
					player.resumeStatus === 'auth' ||
					player.resumeStatus === 'plan' ||
					player.resumeStatus === 'temporary' ||
					player.playbackMode === 'embed')
			)
	);
	const queueNeedsAttention = $derived(includeQueueSync && player.persistenceStatus !== 'saved');
	const visible = $derived((includePlayback && playbackNeedsAttention) || queueNeedsAttention);
</script>

{#if visible}
	<div class="mobile-recovery">
		{#if includePlayback && playbackNeedsAttention}
			<PlaybackStatus mobile attentionOnly />
		{/if}
		{#if queueNeedsAttention}
			<div class="queue-recovery">
				<SessionSaveStatus mobile compactText />
			</div>
		{/if}
	</div>
{/if}

<style>
	.mobile-recovery {
		display: flex;
		flex: none;
		flex-direction: column;
		background: color-mix(in oklab, var(--surface-raised) 94%, transparent);
	}

	.queue-recovery {
		display: flex;
		min-height: 48px;
		align-items: center;
		padding-inline: clamp(1rem, 5vw, 1.5rem);
		border-bottom: 1px solid var(--border-subtle);
	}
</style>
