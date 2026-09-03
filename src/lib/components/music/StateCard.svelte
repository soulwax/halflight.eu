<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { TidalPageState } from '#lib/tidal/page-state';

	let {
		state,
		configured = true,
		title,
		description,
		retryHref
	}: {
		state?: TidalPageState | 'disconnected' | null;
		configured?: boolean;
		title?: string;
		description?: string;
		retryHref?: string;
	} = $props();

	const defaultRetryHref = $derived(retryHref ?? resolve('/app/search'));
</script>

{#if state === 'not_connected' || state === 'disconnected'}
	<section class="state-card" aria-labelledby="connect-title">
		<h2 id="connect-title">{title ?? m.home_connect_title()}</h2>
		<p>{description ?? m.home_connect_description()}</p>
		<div class="state-card-actions">
			{#if configured}
				<a href={resolve('/app/settings/tidal')} class="btn-base btn-primary"
					>{m.home_connect_button()}</a
				>
			{:else}
				<p class="text-xs text-[var(--text-muted)]">{m.tidal_not_configured()}</p>
			{/if}
		</div>
	</section>
{:else if state === 'authorization_expired'}
	<section class="state-card" aria-labelledby="reconnect-title">
		<h2 id="reconnect-title">{title ?? m.track_authorization_expired_title()}</h2>
		<p>{description ?? m.track_authorization_expired_description()}</p>
		<div class="state-card-actions">
			<a href={resolve('/tidal/connect')} class="btn-base btn-primary">{m.tidal_reconnect()}</a>
			<a href={defaultRetryHref} class="btn-base">{m.track_retry()}</a>
		</div>
	</section>
{:else if state === 'not_found' || state === 'invalid_id'}
	<section class="state-card" aria-labelledby="not-found-title">
		<h2 id="not-found-title">{title ?? m.track_not_found_title()}</h2>
		<p>{description ?? m.track_not_found_description()}</p>
		<div class="state-card-actions">
			<a href={resolve('/app/search')} class="btn-base btn-primary">{m.track_back_to_search()}</a>
		</div>
	</section>
{:else if state === 'unavailable'}
	<section class="state-card" aria-labelledby="error-title">
		<h2 id="error-title">{title ?? m.track_unavailable_title()}</h2>
		<p>{description ?? m.track_unavailable_description()}</p>
		<div class="state-card-actions">
			<a href={defaultRetryHref} class="btn-base btn-primary">{m.track_retry()}</a>
			<a href={resolve('/app/search')} class="btn-base">{m.track_back_to_search()}</a>
		</div>
	</section>
{:else if title || description}
	<section class="state-card" aria-labelledby="generic-state-title">
		{#if title}
			<h2 id="generic-state-title">{title}</h2>
		{/if}
		{#if description}
			<p>{description}</p>
		{/if}
	</section>
{/if}
