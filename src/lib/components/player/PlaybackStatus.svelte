<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import Button from '#lib/components/ui/Button.svelte';
	let { mobile = false }: { mobile?: boolean } = $props();
	const settingsHref = $derived(
		mobile ? resolve('/(mobile)/settings') : resolve('/app/settings/tidal')
	);
</script>

{#if player.isPlaybackActiveElsewhere}
	<div class="playback-notice" role="status">
		<p>{m.now_playing_elsewhere()}</p>
		<Button
			disabled={player.playbackClaimPending || player.isLoading}
			onclick={() => player.playHere()}
		>
			{m.now_play_here()}
		</Button>
	</div>
{:else if player.isLoading || player.isBuffering}
	<p class="playback-pending" role="status">
		{player.isLoading ? m.player_loading() : m.player_buffering()}
	</p>
{:else if player.playbackMode === 'embed' && player.currentTrack}
	<div class="playback-notice" role="status">
		<p>{player.requiresFullAuth ? m.player_source_link() : m.player_fallback()}</p>
		<div class="notice-actions">
			<Button onclick={() => player.retryPlayback()}>{m.track_retry()}</Button>
			{#if player.requiresFullAuth}
				<Button href={settingsHref}>{m.tidal_settings_title()}</Button>
			{:else}
				<Button
					href={`https://tidal.com/browse/track/${encodeURIComponent(player.currentTrack.id)}`}
					target="_blank"
					rel="noreferrer">{m.action_open_in_tidal()}</Button
				>
			{/if}
		</div>
	</div>
{/if}

<style>
	.playback-notice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.playback-notice p {
		flex: 1 1 12rem;
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
	}
	.notice-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.playback-pending {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
	}
	:global(.playback-notice .btn-base) {
		min-height: 48px;
	}
</style>
