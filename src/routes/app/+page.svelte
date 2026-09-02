<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Syn</title>
	<meta name="description" content={m.home_subtitle()} />
</svelte:head>

<section class="welcome" aria-labelledby="home-title">
	<p class="eyebrow">SYN</p>
	<h1 id="home-title">{m.home_title({ name: data.user.name })}</h1>
	<p class="intro">{m.home_subtitle()}</p>

	{#if data.connection.connected}
		<article class="action-card">
			<h2>{m.home_search_title()}</h2>
			<p>{m.home_search_description()}</p>
			<a href={resolve('/app/search')}>{m.home_search_button()}</a>
		</article>
	{:else}
		<article class="action-card">
			<h2>{m.home_connect_title()}</h2>
			<p>{m.home_connect_description()}</p>
			<a href={resolve('/app/settings/tidal')}>{m.home_connect_button()}</a>
		</article>
	{/if}
</section>

<style>
	.welcome {
		max-width: 48rem;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		letter-spacing: -0.055em;
	}

	.intro {
		margin: 0.75rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.action-card {
		border: 1px solid var(--border-subtle);
		border-radius: 1.25rem;
		background: var(--surface-raised);
		padding: clamp(1.25rem, 4vw, 2rem);
	}

	.action-card h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.action-card p {
		margin: 0.5rem 0 1.25rem;
		color: var(--text-muted);
	}

	.action-card a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		border-radius: 0.75rem;
		background: var(--action);
		padding: 0.75rem 1rem;
		color: var(--action-contrast);
		font-weight: 700;
		text-decoration: none;
	}
</style>
