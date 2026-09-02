<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download, ExternalLink, ListPlus, Mic2, Music, Play, Sparkles } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { downloadM3u8File, generateM3u8 } from '#lib/utils/m3u';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const retryHref = $derived(
		data.id ? resolve('/app/tracks/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalTrackUrl = $derived(
		data.track ? `https://tidal.com/browse/track/${encodeURIComponent(data.track.id)}` : ''
	);
	const tidalEmbedUrl = $derived(
		data.track ? `https://embed.tidal.com/tracks/${encodeURIComponent(data.track.id)}` : ''
	);

	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function formatQuality(quality: string): string {
		return quality.replaceAll('_', ' ');
	}
</script>

<svelte:head>
	<title>{data.track ? `${data.track.title} — Syn` : `${m.track_title()} — Syn`}</title>
	<meta
		name="description"
		content={data.track
			? m.track_description({ title: data.track.title })
			: m.track_description_empty()}
	/>
</svelte:head>

<section class="track-page" aria-labelledby="track-title">
	{#if data.track}
		<header class="track-header">
			{#if data.track.imageUrl}
				<img class="cover" src={data.track.imageUrl} alt={`Cover for ${data.track.title}`} />
			{:else if data.track.album?.imageUrl}
				<img class="cover" src={data.track.album.imageUrl} alt={`Cover for ${data.track.title}`} />
			{:else}
				<div class="cover cover-placeholder" aria-hidden="true"><Music size={48} /></div>
			{/if}
			<div class="heading">
				<p class="eyebrow">SYN // TRACK SPECIFICATION</p>
				<h1 id="track-title">{data.track.title}</h1>
				{#if data.track.artists.length}
					<p class="artist-line">
						{#each data.track.artists as artist, i (artist.id)}
							<a href={resolve('/app/artists/[id]', { id: artist.id })}>{artist.name}</a
							>{#if i < data.track.artists.length - 1},
							{/if}
						{/each}
					</p>
				{/if}
				{#if data.track.album}
					<p class="album-line">
						<a href={resolve('/app/albums/[id]', { id: data.track.album.id })}
							>{data.track.album.title}</a
						>
					</p>
				{/if}
			</div>
		</header>

		<section class="player" aria-label={`Play ${data.track.title} on TIDAL`}>
			<iframe
				title={`TIDAL player: ${data.track.title}`}
				src={tidalEmbedUrl}
				allow="autoplay; encrypted-media"
			></iframe>
		</section>

		<div class="track-layout">
			<section class="metadata-section" aria-labelledby="about-title">
				<h2 id="about-title">Track Metadata</h2>
				<dl class="metadata">
					{#if data.track.artists.length}
						<div>
							<dt>{m.track_artists()}</dt>
							<dd>
								{#each data.track.artists as artist, i (artist.id)}
									<a class="meta-link" href={resolve('/app/artists/[id]', { id: artist.id })}
										>{artist.name}</a
									>{#if i < data.track.artists.length - 1},
									{/if}
								{/each}
							</dd>
						</div>
					{/if}

					{#if data.track.album}
						<div>
							<dt>{m.track_album()}</dt>
							<dd>
								<a class="meta-link" href={resolve('/app/albums/[id]', { id: data.track.album.id })}
									>{data.track.album.title}</a
								>
							</dd>
						</div>
					{/if}

					{#if data.track.copyright}
						<div>
							<dt>Copyright</dt>
							<dd>{data.track.copyright}</dd>
						</div>
					{/if}
					{#if data.track.isrc}
						<div>
							<dt>ISRC</dt>
							<dd class="font-mono">{data.track.isrc}</dd>
						</div>
					{/if}
				</dl>
			</section>

			<section class="facts" aria-label="Track details">
				{#if data.track.duration}<div>
						<span>Duration</span><strong class="font-mono"
							>{formatDuration(data.track.duration)}</strong
						>
					</div>{/if}
				{#if data.track.trackNumber}<div>
						<span>Track</span><strong class="font-mono">{data.track.trackNumber}</strong>
					</div>{/if}
				{#if data.track.volumeNumber}<div>
						<span>Disc</span><strong class="font-mono">{data.track.volumeNumber}</strong>
					</div>{/if}
				{#if data.track.audioQuality}<div>
						<span>Quality</span><strong class="quality-tag"
							>{formatQuality(data.track.audioQuality)}</strong
						>
					</div>{/if}
				{#if data.track.popularity !== undefined}<div>
						<span>Popularity</span><strong class="font-mono">{data.track.popularity}%</strong>
					</div>{/if}
				{#if data.track.explicit !== undefined}<div>
						<span>Content</span><strong>{data.track.explicit ? 'Explicit [E]' : 'Clean'}</strong>
					</div>{/if}
			</section>
		</div>

		<div class="actions">
			<button type="button" class="syn-play-btn" onclick={() => player.play(data.track!)}>
				<Play size={16} fill="currentColor" />
				{m.player_play_track()}
			</button>
			<button type="button" class="syn-queue-btn" onclick={() => player.addToQueue(data.track!)}>
				<ListPlus size={16} />
				{m.player_add_to_queue()}
			</button>
			<button
				type="button"
				class="syn-queue-btn"
				onclick={() => {
					if (!data.track) return;
					const m3uContent = generateM3u8(data.track.title, [data.track]);
					downloadM3u8File(`${data.track.title}.m3u8`, m3uContent);
				}}
				title="Export Track as M3U8"
				aria-label="Export Track as M3U8"
			>
				<Download size={15} />
				M3U8
			</button>
			<a class="tidal-link" href={tidalTrackUrl} rel="noreferrer" target="_blank">
				<Play size={15} fill="currentColor" /> Open in TIDAL <ExternalLink size={13} />
			</a>
			<a class="back-link" href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</div>

		{#if data.lyrics}
			<section class="relation-section lyrics-page-section" aria-labelledby="track-lyrics-title">
				<div class="section-header">
					<div class="flex items-center gap-2">
						<Mic2 size={20} class="text-[var(--action)]" />
						<h2 id="track-lyrics-title" class="relation-title">Track Lyrics</h2>
					</div>
					{#if data.lyrics.lyricsProvider}
						<span class="font-mono text-xs text-[var(--text-muted)] uppercase">
							Source: {data.lyrics.lyricsProvider}
						</span>
					{/if}
				</div>

				{#if data.lyrics.cues && data.lyrics.cues.length > 0}
					<div class="lyrics-cues-grid">
						{#each data.lyrics.cues as cue (cue.time + cue.text)}
							<button
								type="button"
								class="page-lyric-cue"
								class:active={player.currentTrack?.id === data.track?.id &&
									player.activeLyricIndex >= 0 &&
									data.lyrics.cues[player.activeLyricIndex]?.time === cue.time}
								onclick={() => {
									if (player.currentTrack?.id !== data.track?.id) {
										player.play(data.track!);
									}
									player.seek(cue.time);
								}}
							>
								<span class="shrink-0 font-mono text-xs text-[var(--text-muted)] opacity-70">
									{formatDuration(cue.time)}
								</span>
								<span class="cue-lyric-text">{cue.text}</span>
							</button>
						{/each}
					</div>
				{:else if data.lyrics.lyrics}
					<div class="plain-lyrics-container">
						{#each data.lyrics.lyrics.split('\n') as line, idx (idx)}
							<p>{line}</p>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		{#if data.track.radioTracks && data.track.radioTracks.length}
			<section class="relation-section" aria-labelledby="radio-title">
				<div class="section-header">
					<div>
						<h2 id="radio-title" class="relation-title">
							<Sparkles size={20} class="text-[var(--action)]" />
							{m.track_radio_title()}
						</h2>
						<p class="relation-subtitle">{m.track_radio_subtitle()}</p>
					</div>
					<button
						type="button"
						class="play-all-btn"
						onclick={() => player.play(data.track!.radioTracks![0], data.track!.radioTracks)}
					>
						<Play size={14} fill="currentColor" />
						{m.player_play_all()}
					</button>
				</div>
				<div class="song-cards-grid">
					{#each data.track.radioTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.track.radioTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.track.artistTopTracks && data.track.artistTopTracks.length && data.track.artists.length}
			<section class="relation-section" aria-labelledby="artist-tracks-title">
				<div class="section-header">
					<div>
						<h2 id="artist-tracks-title" class="relation-title">
							{m.track_more_by_artist({ name: data.track.artists[0].name })}
						</h2>
					</div>
					<button
						type="button"
						class="play-all-btn"
						onclick={() =>
							player.play(data.track!.artistTopTracks![0], data.track!.artistTopTracks)}
					>
						<Play size={14} fill="currentColor" />
						{m.player_play_all()}
					</button>
				</div>
				<div class="song-cards-grid">
					{#each data.track.artistTopTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.track.artistTopTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}
	{:else if data.state === 'not_connected'}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_not_connected_title()}</h1>
			<p>{m.track_not_connected_description()}</p>
			{#if data.configured}
				<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
			{:else}
				<p>{m.tidal_not_configured()}</p>
			{/if}
		</section>
	{:else if data.state === 'authorization_expired'}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_authorization_expired_title()}</h1>
			<p>{m.track_authorization_expired_description()}</p>
			<a href={resolve('/tidal/connect')}>{m.tidal_reconnect()}</a>
		</section>
	{:else if data.state === 'not_found' || data.state === 'invalid_id'}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_not_found_title()}</h1>
			<p>{m.track_not_found_description()}</p>
			<a href={resolve('/app/search')}>{m.track_back_to_search()}</a>
		</section>
	{:else}
		<section class="state-card" aria-labelledby="track-title">
			<h1 id="track-title">{m.track_unavailable_title()}</h1>
			<p role="alert">{m.track_unavailable_description()}</p>
			<a href={retryHref}>{m.track_retry()}</a>
		</section>
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.track-page {
		max-width: 72rem;
	}

	h1,
	p,
	dd {
		margin-top: 0;
	}

	.track-header {
		display: flex;
		align-items: end;
		gap: clamp(1.25rem, 3vw, 2.5rem);
		border-bottom: 2px solid var(--border-subtle);
		padding-bottom: 2rem;
	}

	.cover {
		width: clamp(8rem, 19vw, 13rem);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-md, 10px);
		background: var(--surface-canvas);
		object-fit: cover;
		box-shadow: var(--shadow-bauhaus);
	}

	.cover-placeholder {
		display: grid;
		place-items: center;
		color: var(--text-muted);
	}

	.heading {
		min-width: 0;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin-bottom: 0;
		overflow-wrap: anywhere;
		font-size: clamp(2.2rem, 5vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.artist-line,
	.album-line {
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
	}

	.artist-line {
		font-size: 1.15rem;
		font-weight: 700;
	}

	.artist-line a,
	.album-line a,
	.meta-link {
		color: inherit;
		text-decoration: none;
	}

	.artist-line a:hover,
	.album-line a:hover,
	.meta-link:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.album-line {
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.player {
		margin-top: 2rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-lg, 14px);
		overflow: hidden;
		background: var(--surface-raised);
		box-shadow: var(--shadow-bauhaus);
	}

	.player iframe {
		display: block;
		width: 100%;
		height: 9.5rem;
		border: 0;
	}

	.track-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.7fr);
		gap: 1.25rem;
		margin-top: 1.5rem;
	}

	.metadata-section,
	.facts {
		border: 2px solid var(--border-subtle);
		background: var(--surface-raised);
	}

	.metadata-section {
		padding: clamp(1.25rem, 3vw, 1.75rem);
	}

	.metadata-section h2 {
		margin: 0 0 1.25rem;
		font-size: 1.15rem;
		font-weight: 800;
		text-transform: uppercase;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.5rem;
	}

	.metadata {
		margin: 0;
		border: 0;
		background: none;
		padding: 0;
		display: grid;
		gap: 1rem;
	}

	.metadata div {
		display: grid;
		gap: 0.2rem;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	dd {
		margin-bottom: 0;
		font-size: 1.05rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.facts {
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.facts div {
		display: grid;
		min-height: 5rem;
		align-content: center;
		gap: 0.35rem;
		padding: 1rem;
		border-right: 1px solid var(--border-subtle);
		border-bottom: 1px solid var(--border-subtle);
	}

	.facts div:nth-child(2n) {
		border-right: 0;
	}

	.facts div:nth-last-child(-n + 2) {
		border-bottom: 0;
	}

	.facts span {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.facts strong {
		font-size: 1.05rem;
		overflow-wrap: anywhere;
	}

	.quality-tag {
		color: var(--action);
		text-transform: uppercase;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.75rem;
	}

	.syn-play-btn {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		gap: 0.45rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		padding: 0.6rem 1.25rem;
		color: var(--action-contrast);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.syn-play-btn:hover {
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.syn-queue-btn {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		gap: 0.45rem;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-raised);
		padding: 0.6rem 1.15rem;
		color: var(--text-primary);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.syn-queue-btn:hover {
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.lyrics-page-section {
		margin-top: 2rem;
	}

	.lyrics-cues-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 28rem;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.page-lyric-cue {
		display: flex;
		align-items: baseline;
		gap: 0.85rem;
		width: 100%;
		padding: 0.6rem 0.85rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-canvas);
		text-align: left;
		cursor: pointer;
		color: var(--text-muted);
		font: inherit;
		transition: all 0.12s ease;
	}

	.page-lyric-cue:hover {
		background: var(--surface-selected);
		color: var(--text-primary);
		transform: translateX(4px);
	}

	.page-lyric-cue.active {
		background: var(--surface-sunken);
		border-color: var(--action);
		color: var(--text-primary);
		font-weight: 700;
	}

	.page-lyric-cue.active .cue-lyric-text {
		color: var(--action);
	}

	.cue-lyric-text {
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.plain-lyrics-container {
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.tidal-link {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		gap: 0.4rem;
		background: var(--surface-canvas);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		padding: 0.6rem 1.15rem;
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
		transition: all 0.12s ease;
	}

	.tidal-link:hover {
		box-shadow: var(--shadow-bauhaus);
		transform: translate(-1px, -1px);
	}

	.state-card {
		margin-top: 2rem;
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface-raised);
		padding: clamp(1.5rem, 3.5vw, 2rem);
	}

	.state-card p {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.state-card a,
	.back-link {
		display: inline-flex;
		min-height: 2.85rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-sm, 6px);
		padding: 0.6rem 1.15rem;
		font-weight: 800;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-decoration: none;
	}

	.state-card a {
		background: var(--action);
		color: var(--action-contrast);
	}

	.back-link {
		color: var(--text-primary);
		background: transparent;
	}

	.back-link:hover {
		background: var(--surface-selected);
	}

	.relation-section {
		margin-top: 3.5rem;
		border-top: 2px solid var(--border-subtle);
		padding-top: 2rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.relation-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.relation-subtitle {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.play-all-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--action);
		border-radius: var(--radius-sm, 6px);
		background: var(--action);
		color: var(--action-contrast);
		padding: 0.45rem 0.95rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.play-all-btn:hover {
		box-shadow: 2px 2px 0px var(--border-strong);
		transform: translate(-1px, -1px);
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
		gap: 1.15rem;
	}

	.attribution {
		margin-top: 3rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.attribution a {
		color: inherit;
	}

	@media (max-width: 42rem) {
		.track-header {
			align-items: start;
		}
		.track-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
