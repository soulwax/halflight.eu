<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download, ListPlus, Mic2, Play, Sparkles } from '@lucide/svelte';
	import SongCard from '#lib/components/music/SongCard.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { formatClock, formatDuration } from '#lib/format';
	import { downloadM3u8File, generateM3u8 } from '#lib/utils/m3u';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
	import PageHeader from '#lib/components/music/PageHeader.svelte';
	import StateCard from '#lib/components/music/StateCard.svelte';
	import PageActions from '#lib/components/music/PageActions.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const retryHref = $derived(
		data.id ? resolve('/app/tracks/[id]', { id: data.id }) : resolve('/app/search')
	);
	const tidalTrackUrl = $derived(
		data.track ? `https://tidal.com/browse/track/${encodeURIComponent(data.track.id)}` : ''
	);
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
		<PageHeader
			title={data.track.title}
			imageUrl={data.track.imageUrl ?? data.track.album?.imageUrl}
			eyebrow="SYN // TRACK SPECIFICATION"
			type="track"
		>
			{#if data.track.artists.length}
				<p class="artist-line">
					{#each data.track.artists as artist, i (artist.id || i)}
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

			{#snippet actions()}
				<Button variant="primary" onclick={() => player.play(data.track!)}>
					<Play size={14} fill="currentColor" />
					{m.player_play_track()}
				</Button>

				<Button variant="secondary" onclick={() => player.addToQueue(data.track!)}>
					<ListPlus size={14} />
					{m.player_add_to_queue()}
				</Button>

				<Button
					variant="secondary"
					onclick={() => {
						if (!data.track) return;
						const m3uContent = generateM3u8(data.track.title, [data.track]);
						downloadM3u8File(`${data.track.title}.m3u8`, m3uContent);
					}}
					title={m.action_export_track_m3u8()}
					ariaLabel={m.action_export_track_m3u8()}
				>
					<Download size={14} />
					M3U8
				</Button>
			{/snippet}
		</PageHeader>

		<div class="track-layout">
			<section class="metadata-section" aria-labelledby="about-title">
				<h2
					id="about-title"
					class="mb-3 text-xs font-bold tracking-wider text-[var(--accent-gold)] uppercase"
				>
					Track Metadata
				</h2>
				<dl class="metadata">
					{#if data.track.artists.length}
						<div>
							<dt>{m.track_artists()}</dt>
							<dd>
								{#each data.track.artists as artist, i (artist.id || i)}
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

			<section class="facts" aria-label={m.track_details_label()}>
				{#if data.track.duration}
					<div>
						<span>Duration</span>
						<strong class="font-mono">{formatDuration(data.track.duration)}</strong>
					</div>
				{/if}
				{#if data.track.trackNumber}
					<div>
						<span>Track</span>
						<strong class="font-mono">{data.track.trackNumber}</strong>
					</div>
				{/if}
				{#if data.track.volumeNumber}
					<div>
						<span>Disc</span>
						<strong class="font-mono">{data.track.volumeNumber}</strong>
					</div>
				{/if}
				{#if data.track.audioQuality}
					<div>
						<span>Quality</span>
						<Badge variant="quality" text={data.track.audioQuality} />
					</div>
				{/if}
				{#if data.track.popularity !== undefined}
					<div>
						<span>Popularity</span>
						<strong class="font-mono">{data.track.popularity}%</strong>
					</div>
				{/if}
				{#if data.track.explicit !== undefined}
					<div>
						<span>Content</span>
						<strong>{data.track.explicit ? 'Explicit [E]' : 'Clean'}</strong>
					</div>
				{/if}
			</section>
		</div>

		{#if data.lyrics}
			<section class="lyrics-page-section" aria-labelledby="track-lyrics-title">
				<SectionHeader title={m.track_lyrics_heading()} titleId="track-lyrics-title">
					<Mic2 size={18} class="text-[var(--action)]" />
					{#snippet actions()}
						{#if data.lyrics?.lyricsProvider}
							<span class="font-mono text-xs text-[var(--text-muted)] uppercase">
								Source: {data.lyrics.lyricsProvider}
							</span>
						{/if}
					{/snippet}
				</SectionHeader>

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
									{formatClock(cue.time)}
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
				<SectionHeader
					title={m.track_radio_title()}
					titleId="radio-title"
					subtitle={m.track_radio_subtitle()}
				>
					<Sparkles size={18} class="text-[var(--action)]" />
					{#snippet actions()}
						<Button
							variant="primary"
							onclick={() => player.play(data.track!.radioTracks![0], data.track!.radioTracks)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>
					{/snippet}
				</SectionHeader>

				<div class="song-cards-grid">
					{#each data.track.radioTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.track.radioTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.track.artistTopTracks && data.track.artistTopTracks.length && data.track.artists.length}
			<section class="relation-section" aria-labelledby="artist-tracks-title">
				<SectionHeader
					title={m.track_more_by_artist({ name: data.track.artists[0].name })}
					titleId="artist-tracks-title"
				>
					{#snippet actions()}
						<Button
							variant="primary"
							onclick={() =>
								player.play(data.track!.artistTopTracks![0], data.track!.artistTopTracks)}
						>
							<Play size={14} fill="currentColor" />
							{m.player_play_all()}
						</Button>
					{/snippet}
				</SectionHeader>
				<div class="song-cards-grid">
					{#each data.track.artistTopTracks as track, index (track.id)}
						<SongCard {track} contextTracks={data.track.artistTopTracks} {index} />
					{/each}
				</div>
			</section>
		{/if}

		<PageActions tidalUrl={tidalTrackUrl} tidalLabel="Open in TIDAL" {retryHref} />
	{:else}
		<StateCard state={data.state} configured={data.configured} {retryHref} />
	{/if}
</section>

<style>
	.artist-line {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.artist-line a {
		color: var(--text-primary);
		text-decoration: none;
	}

	.artist-line a:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.album-line {
		margin: 0;
		font-size: 0.9rem;
	}

	.album-line a {
		color: var(--text-muted);
		text-decoration: none;
	}

	.album-line a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.track-layout {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.metadata-section,
	.facts {
		padding: 1.25rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-md);
	}

	.metadata {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	.metadata div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.metadata dt {
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.metadata dd {
		margin: 0;
		font-size: 0.88rem;
		color: var(--text-primary);
	}

	.meta-link {
		color: inherit;
		text-decoration: none;
	}

	.meta-link:hover {
		color: var(--action);
		text-decoration: underline;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.85rem;
	}

	.facts div {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.facts span {
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.facts strong {
		font-size: 0.95rem;
		color: var(--text-primary);
	}

	.lyrics-page-section,
	.relation-section {
		margin-top: 2.75rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 2rem;
	}

	.lyrics-cues-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 0.5rem;
	}

	.page-lyric-cue {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.9rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		border-radius: var(--radius-sm);
		text-align: left;
		cursor: pointer;
		color: var(--text-primary);
		transition: all 0.12s ease;
	}

	.page-lyric-cue:hover {
		border-color: var(--border-strong);
		background: var(--surface-selected);
	}

	.page-lyric-cue.active {
		border-color: var(--action);
		background: color-mix(in oklch, var(--accent-gold) 15%, var(--surface-canvas));
		color: var(--action);
		font-weight: 700;
	}

	.plain-lyrics-container {
		padding: 1.5rem;
		background: var(--surface-raised);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		line-height: 1.8;
		color: var(--text-muted);
		max-height: 25rem;
		overflow-y: auto;
	}

	.song-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1.15rem;
	}
</style>
