<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const retryHref = $derived(
		data.id ? resolve('/app/tracks/[id]', { id: data.id }) : resolve('/app/search')
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
		<header>
			<p class="eyebrow">{m.track_label()}</p>
			<h1 id="track-title">{data.track.title}</h1>
		</header>

		<dl class="metadata">
			{#if data.track.artists.length}
				<div>
					<dt>{m.track_artists()}</dt>
					<dd>{data.track.artists.map((artist) => artist.name).join(', ')}</dd>
				</div>
			{/if}
			{#if data.track.album}
				<div>
					<dt>{m.track_album()}</dt>
					<dd>{data.track.album.title}</dd>
				</div>
			{/if}
		</dl>

		<a class="back-link" href={resolve('/app/search')}>{m.track_back_to_search()}</a>
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
		max-width: 48rem;
	}

	h1,
	p,
	dd {
		margin-top: 0;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1 {
		margin-bottom: 0;
		overflow-wrap: anywhere;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.metadata,
	.state-card {
		margin-top: 2rem;
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.1rem, 3vw, 1.5rem);
	}

	.metadata {
		display: grid;
		gap: 1rem;
	}

	.metadata div {
		display: grid;
		gap: 0.25rem;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 700;
	}

	dd {
		font-size: 1.1rem;
		overflow-wrap: anywhere;
	}

	.state-card p {
		margin-bottom: 1rem;
		color: var(--text-muted);
	}

	.state-card a,
	.back-link {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		font-weight: 700;
		text-decoration: none;
	}

	.state-card a {
		background: var(--action);
		color: var(--action-contrast);
	}

	.back-link {
		margin-top: 1.5rem;
		color: var(--text-primary);
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
