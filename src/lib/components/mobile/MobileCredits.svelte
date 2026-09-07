<script lang="ts">
	import { resolve } from '$app/paths';
	import { Loader2 } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';
	import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';
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
	<MobileSubScreenHeader
		backHref={resolve('/(mobile)/now')}
		backLabel={m.now_credits_back()}
		heading={m.now_credits_title()}
		subtitle={track?.title}
		headingId="mobile-credits-title"
	/>
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
		padding: clamp(1rem, 4vw, 1.5rem) clamp(1.25rem, 5vw, 2rem) clamp(2rem, 8vw, 3rem);
	}
	p {
		margin: 0;
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
