<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sectionLabel: Record<string, () => string> = {
		albums: m.search_albums,
		artists: m.search_artists,
		tracks: m.search_tracks,
		playlists: m.search_playlists
	};

	const mark: Record<string, string> = {
		albums: '▣',
		artists: '●',
		tracks: '♪',
		playlists: '≡'
	};

	type Item = {
		kind: string;
		id: string;
		title?: string;
		name?: string;
		artists?: { name: string }[];
	};

	function titleOf(item: Item): string {
		return item.title ?? item.name ?? '';
	}

	function subtitleOf(item: Item): string {
		return item.artists?.map((artist) => artist.name).join(', ') ?? '';
	}
</script>

<svelte:head>
	<title>{m.library_title()} — Syn</title>
	<meta name="description" content={m.library_subtitle()} />
</svelte:head>

<section class="library" aria-labelledby="library-title">
	<header>
		<p class="eyebrow">TIDAL</p>
		<h1 id="library-title">{m.library_title()}</h1>
		<p class="intro">{m.library_subtitle()}</p>
	</header>

	{#if !data.connected}
		<section class="state-card" aria-labelledby="connect-title">
			<h2 id="connect-title">{m.search_not_connected_title()}</h2>
			<p>{m.search_not_connected_description()}</p>
			<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
		</section>
	{:else if data.sections}
		{#each data.sections as section (section.kind)}
			<section class="result-group" aria-labelledby="{section.kind}-title">
				<h2 id="{section.kind}-title">
					{sectionLabel[section.kind]()}
					{#if section.ok && section.hasMore}<span class="more">· {m.library_has_more()}</span>{/if}
				</h2>

				{#if !section.ok}
					<p class="group-empty" role="alert">{m.library_section_error()}</p>
				{:else if section.items.length === 0}
					<p class="group-empty">{m.library_section_empty()}</p>
				{:else}
					<ul>
						{#each section.items as item (item.id)}
							<li>
								<div class="media-mark" aria-hidden="true">{mark[section.kind]}</div>
								{#if item.kind === 'track'}
									<a class="item-link" href={resolve('/app/tracks/[id]', { id: item.id })}>
										<strong>{titleOf(item)}</strong>
										{#if subtitleOf(item)}<span>{subtitleOf(item)}</span>{/if}
									</a>
								{:else}
									<div class="item-link">
										<strong>{titleOf(item)}</strong>
										{#if subtitleOf(item)}<span>{subtitleOf(item)}</span>{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{/if}

	<p class="attribution">
		<a href="https://tidal.com" rel="noreferrer">{m.tidal_attribution()}</a>
	</p>
</section>

<style>
	.library {
		max-width: 64rem;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.intro {
		margin: 0.75rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.state-card,
	.result-group {
		margin-top: 1rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.state-card h2,
	.result-group h2 {
		margin-bottom: 0.5rem;
		font-size: 1.15rem;
	}

	.more {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 400;
	}

	.group-empty,
	.result-group span {
		color: var(--text-muted);
	}

	.group-empty {
		margin: 0;
		font-size: 0.9rem;
	}

	.state-card p {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.state-card a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font-weight: 700;
		text-decoration: none;
	}

	.result-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.result-group li {
		display: flex;
		min-height: 3.5rem;
		align-items: center;
		gap: 0.75rem;
		border-top: 1px solid var(--border-subtle);
		padding: 0.7rem 0;
	}

	.result-group li:first-child {
		border-top: 0;
	}

	.item-link {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
		color: inherit;
		text-decoration: none;
	}

	a.item-link:hover strong,
	a.item-link:focus-visible strong {
		text-decoration: underline;
	}

	.media-mark {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.65rem;
		background: var(--surface-selected);
		color: var(--text-primary);
		font-weight: 700;
	}

	.attribution {
		margin-top: 2rem;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.attribution a {
		color: inherit;
	}
</style>
