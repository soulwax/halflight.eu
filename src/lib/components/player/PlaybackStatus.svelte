<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import Button from '#lib/components/ui/Button.svelte';
	let { mobile = false, attentionOnly = false }: { mobile?: boolean; attentionOnly?: boolean } =
		$props();
	const settingsHref = $derived(
		mobile ? resolve('/(mobile)/settings') : resolve('/app/settings/tidal')
	);
</script>

{#if player.isPlaybackActiveElsewhere}
	<div class="playback-notice" class:compact={mobile && attentionOnly} role="status">
		<p>{m.now_playing_elsewhere()}</p>
		<Button
			disabled={player.playbackClaimPending || player.isLoading}
			onclick={() => player.playHere()}
		>
			{m.now_play_here()}
		</Button>
	</div>
{:else if !attentionOnly && (player.isLoading || player.isBuffering)}
	<p class="playback-pending" role="status">
		{player.isLoading ? m.player_loading() : m.player_buffering()}
	</p>
{:else if !attentionOnly && player.currentTrack && player.resumeStatus === 'checking' && !player.isPlaying}
	<p class="playback-pending" role="status">{m.player_check_pending()}</p>
{:else if player.currentTrack && player.resumeStatus === 'unavailable'}
	<div class="playback-notice" class:compact={mobile && attentionOnly} role="status">
		<p>{m.player_unavailable_track()}</p>
		<Button onclick={() => player.next()}>{m.player_skip_unavailable()}</Button>
	</div>
{:else if player.currentTrack && player.resumeStatus === 'auth'}
	<div class="playback-notice" class:compact={mobile && attentionOnly} role="status">
		<p>{m.player_source_link()}</p>
		<Button href={settingsHref}>{m.tidal_settings_title()}</Button>
	</div>
{:else if player.currentTrack && player.resumeStatus === 'plan'}
	<div class="playback-notice" class:compact={mobile && attentionOnly} role="status">
		<p>{m.player_plan_failure()}</p>
		<Button
			href={`https://tidal.com/browse/track/${encodeURIComponent(player.currentTrack.id)}`}
			target="_blank"
			rel="noreferrer">{m.action_open_in_tidal()}</Button
		>
	</div>
{:else if player.currentTrack && player.resumeStatus === 'temporary' && player.playbackMode !== 'embed'}
	<div class="playback-notice" class:compact={mobile && attentionOnly} role="status">
		<p>{m.player_temporary_failure()}</p>
		<Button onclick={() => player.retryPlayback()}>{m.track_retry()}</Button>
	</div>
{:else if player.playbackMode === 'embed' && player.currentTrack}
	<div class="playback-notice" class:compact={mobile && attentionOnly} role="status">
		<p>
			{player.requiresFullAuth
				? m.player_source_link()
				: player.playbackReason === 'plan_no_streaming'
					? m.player_plan_failure()
					: player.playbackReason === 'stream_unavailable' ||
						  player.playbackReason === 'network_error'
						? m.player_temporary_failure()
						: m.player_fallback()}
		</p>
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
	.playback-notice.compact {
		gap: 0.5rem;
		padding: 0.35rem clamp(1rem, 5vw, 1.5rem);
		border-width: 0 0 1px;
		border-radius: 0;
		background: color-mix(in oklab, var(--surface-raised) 94%, transparent);
	}
	.playback-notice p {
		flex: 1 1 12rem;
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--fs-sm);
	}
	.playback-notice.compact p {
		font-size: var(--fs-xs);
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
	.playback-notice.compact .notice-actions {
		gap: 0.25rem;
	}
	:global(.playback-notice.compact .btn-base) {
		padding-inline: 0.65rem;
		font-size: var(--fs-xs);
	}
</style>
