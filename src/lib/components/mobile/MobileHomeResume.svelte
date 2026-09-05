<script lang="ts">
	import { resolve } from '$app/paths';
	import { Disc, Play } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { player } from '#lib/player/player.svelte.js';

	const track = $derived(player.currentTrack);
	const cover = $derived(track ? (track.imageUrl ?? track.album?.imageUrl ?? null) : null);
	const artistLine = $derived(track ? track.artists.map((artist) => artist.name).join(', ') : '');
</script>

<div class="flex flex-col gap-3 px-6 py-8">
	<h1 class="sr-only">{m.now_home_heading()}</h1>

	{#if track}
		<p class="text-xs tracking-wide text-(--text-muted) uppercase">
			{m.now_home_continue_heading()}
		</p>
		<a
			href={resolve('/(mobile)/now')}
			aria-label={m.now_home_resume_cta()}
			class="flex items-center gap-4 border border-(--border-subtle) bg-(--surface-raised) p-4"
		>
			<span
				class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-(--border-subtle) bg-(--surface-selected)"
			>
				{#if cover}
					<img src={cover} alt="" class="h-full w-full object-cover" />
				{:else}
					<Disc size={22} class="text-(--text-muted)" />
				{/if}
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate font-semibold text-(--text-primary)">{track.title}</span>
				{#if artistLine}
					<span class="block truncate text-sm text-(--text-muted)">{artistLine}</span>
				{/if}
			</span>
			<Play size={20} class="shrink-0 text-(--action)" fill="currentColor" />
		</a>
	{:else}
		<p class="text-(--text-muted)">{m.now_home_empty()}</p>
	{/if}
</div>
