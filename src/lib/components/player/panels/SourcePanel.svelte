<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock } from '#lib/format';
	import { player } from '#lib/player/player.svelte.js';
	import type { TrackSummary } from '#lib/tidal/models';

	let { track }: { track: TrackSummary } = $props();

	const embedUrl = $derived(`https://embed.tidal.com/tracks/${encodeURIComponent(track.id)}`);
</script>

<div class="source">
	{#if player.playbackMode === 'direct'}
		{@const a = player.assessment}
		<dl class="verify" class:verify-bad={!a.ok}>
			<dt>{m.player_length()}</dt>
			<dd>
				{#if a.actualSeconds != null}
					{formatClock(a.actualSeconds)}
					{#if a.expectedSeconds != null}<span class="verify-dim">
							/ {formatClock(a.expectedSeconds)}</span
						>{/if}
					<span class="verify-tag verify-{a.length}">{a.length}</span>
				{:else}
					<span class="verify-dim">{m.player_check_pending()}</span>
				{/if}
			</dd>
			<dt>{m.player_quality()}</dt>
			<dd>
				<span class="badge-tier-{player.qualityTier}">{player.audioQuality ?? '—'}</span
				>{#if player.codecs}<span class="verify-dim"> · {player.codecs}</span>{/if}
				{#if a.downgraded}<span class="verify-tag verify-short"
						>{m.player_downgraded({ requested: a.requestedQuality ?? '?' })}</span
					>{:else if player.qualityTier === 'hires'}<span class="verify-tag verify-match"
						>HiRes</span
					>{:else if a.lossless}<span class="verify-tag verify-match">FLAC</span>{/if}
			</dd>
		</dl>
		{#if a.warning}<p class="source-note verify-warn">{a.warning}</p>{/if}
	{:else}
		<p class="source-note">
			{#if player.requiresFullAuth}
				{m.player_source_preview()}
				<a href={resolve('/app/settings/tidal')}>{m.player_source_link()}</a>
			{:else}
				{m.player_source_tidal()}
			{/if}
		</p>
		<iframe title={`TIDAL — ${track.title}`} src={embedUrl} allow="autoplay; encrypted-media"
		></iframe>
	{/if}
</div>
