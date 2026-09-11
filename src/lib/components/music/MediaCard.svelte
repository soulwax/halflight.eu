<script lang="ts">
	import { m } from '#lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import { Disc, ListMusic, Sparkles, User } from '@lucide/svelte';
	import type { AlbumSummary, ArtistSummary, PlaylistSummary } from '#lib/tidal/models';

	type MediaItem =
		| AlbumSummary
		| PlaylistSummary
		| ArtistSummary
		| {
				id: string;
				title?: string;
				name?: string;
				imageUrl?: string;
				artists?: Array<{ name: string } | string>;
				kind?: string;
		  };

	let {
		item,
		kind,
		href
	}: {
		item: MediaItem;
		kind?: 'album' | 'playlist' | 'artist' | 'mix';
		href?: string;
	} = $props();

	const itemKind = $derived(
		kind ?? ('kind' in item && typeof item.kind === 'string' ? item.kind : 'album')
	);
	const title = $derived(
		'title' in item && item.title
			? item.title
			: 'name' in item && item.name
				? item.name
				: 'Untitled'
	);
	const artistsString = $derived(
		'artists' in item && Array.isArray(item.artists)
			? item.artists
					.map((a: { name: string } | string) => (typeof a === 'string' ? a : a.name))
					.join(', ')
			: null
	);

	const targetHref = $derived(
		href ??
			(itemKind === 'album'
				? resolve('/app/albums/[id]', { id: item.id })
				: itemKind === 'artist'
					? resolve('/app/artists/[id]', { id: item.id })
					: itemKind === 'playlist'
						? resolve('/app/playlists/[id]', { id: item.id })
						: resolve('/app/mixes'))
	);
</script>

<a class="media-card" href={targetHref}>
	{#if item.imageUrl}
		<img
			class="media-card-cover"
			class:media-card-cover-round={itemKind === 'artist'}
			src={item.imageUrl}
			alt={`Artwork for ${title}`}
			loading="lazy"
		/>
	{:else}
		<div
			class="media-card-cover flex items-center justify-center text-[var(--text-muted)]"
			class:media-card-cover-round={itemKind === 'artist'}
			aria-hidden="true"
		>
			{#if itemKind === 'artist'}
				<User size={32} />
			{:else if itemKind === 'playlist'}
				<ListMusic size={32} />
			{:else if itemKind === 'mix'}
				<Sparkles size={32} />
			{:else}
				<Disc size={32} />
			{/if}
		</div>
	{/if}

	<div class="media-card-body">
		<strong class="media-card-title">{title}</strong>
		{#if artistsString}
			<span class="media-card-subtitle">{artistsString}</span>
		{:else if itemKind === 'playlist'}
			<span class="media-card-subtitle">{m.playlist_label()}</span>
		{:else if itemKind === 'artist'}
			<span class="media-card-subtitle">{m.artist_label()}</span>
		{/if}
	</div>
</a>
