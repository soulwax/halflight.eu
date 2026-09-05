<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft, Loader2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	type Credit = { type: string; contributors: Array<{ name: string }> };
	let credits = $state<Credit[] | null>(null);
	let status = $state<'loading' | 'ready' | 'unavailable' | 'empty'>('loading');
	let requestId = 0;
	const track = $derived(player.currentTrack);
	$effect(() => {
		const current = track;
		const id = ++requestId;
		credits = null;
		if (!current) {
			status = 'empty';
			return;
		}
		status = 'loading';
		void fetch(`/api/tracks/${encodeURIComponent(current.id)}/credits`)
			.then(async (response) =>
				response.ok ? ((await response.json()) as { credits?: Credit[] }) : null
			)
			.then((body) => {
				if (id === requestId) {
					credits = body?.credits ?? [];
					status = credits.length ? 'ready' : 'empty';
				}
			})
			.catch(() => {
				if (id === requestId) status = 'unavailable';
			});
	});
</script>

<section class="mobile-credits" aria-labelledby="mobile-credits-title">
	<header>
		<a href={resolve('/(mobile)/now')} aria-label={m.now_credits_back()}
			><ChevronLeft size={20} /></a
		>
		<div>
			<h1 id="mobile-credits-title">{m.now_credits_title()}</h1>
			{#if track}<p>{track.title}</p>{/if}
		</div>
	</header>
	{#if status === 'loading'}<p class="state" role="status">
			<Loader2 size={20} class="animate-spin" />{m.now_credits_loading()}
		</p>
	{:else if status === 'ready'}<dl>
			{#each credits ?? [] as credit (credit.type)}<div>
					<dt>{credit.type}</dt>
					<dd>{credit.contributors.map(({ name }) => name).join(', ')}</dd>
				</div>{/each}
		</dl>
	{:else if status === 'unavailable'}<p class="state" role="alert">{m.now_credits_unavailable()}</p>
	{:else}<p class="state">{m.now_credits_empty()}</p>{/if}
</section>

<style>
	.mobile-credits {
		min-height: 100%;
		padding: 1rem 1.25rem 2rem;
	}
	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	header a {
		display: grid;
		width: 3rem;
		height: 3rem;
		place-items: center;
		color: var(--text-primary);
	}
	h1,
	p {
		margin: 0;
	}
	h1 {
		font-size: 1.25rem;
	}
	header p {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	dl {
		margin: 0;
	}
	dl div {
		padding: 1rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	dt {
		color: var(--text-muted);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	dd {
		margin: 0.35rem 0 0;
		line-height: 1.45;
	}
	.state {
		display: flex;
		min-height: 12rem;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		color: var(--text-muted);
		text-align: center;
	}
</style>
