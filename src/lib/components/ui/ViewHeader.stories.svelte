<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Code2, Sparkles } from '@lucide/svelte';
	import ViewHeader from './ViewHeader.svelte';
	import Button from './Button.svelte';

	const { Story } = defineMeta({
		title: 'UI/ViewHeader',
		component: ViewHeader,
		tags: ['autodocs'],
		args: {
			title: 'Search TIDAL'
		}
	});
</script>

<Story name="Title only" />

<Story
	name="The standard view header"
	args={{
		eyebrow: 'Halflight // Exploration',
		title: 'Search TIDAL',
		description: 'Find tracks, albums, artists, and playlists.'
	}}
/>

<Story name="With a mark" asChild>
	<ViewHeader
		eyebrow="Halflight // Owner API"
		title="Owner API reference"
		description="Every endpoint this install exposes, with a console to call them."
	>
		{#snippet mark()}<Code2 size={22} />{/snippet}
	</ViewHeader>
</Story>

<Story name="With a mark and an action" asChild>
	<ViewHeader
		eyebrow="Made for this moment"
		title="Generate a set"
		description="Start from your taste, then shape the set before you save it."
	>
		{#snippet mark()}<Sparkles size={22} />{/snippet}
		{#snippet actions()}
			<Button size="sm">Download spec</Button>
			<Button variant="primary" size="sm">Generate</Button>
		{/snippet}
	</ViewHeader>
</Story>

<Story name="Long German copy holds the layout" asChild>
	<!--
		The Definition of done requires checking German specifically — its strings
		run 15-30% longer than English. This is the shape that stresses the header
		most: the longest eyebrow and title in the catalogue, a mark, and an action
		row, at a laptop-narrow measure.
	-->
	<div style="max-width: 34rem;">
		<ViewHeader
			eyebrow="Halflight // Automatische Komposition"
			title="Automatisch zusammengestellte Mixe"
			description="Täglich neu aus deiner Hörhistorie zusammengestellt, jederzeit als eigene Playlist speicherbar."
		>
			{#snippet mark()}<Sparkles size={22} />{/snippet}
			{#snippet actions()}
				<Button variant="primary" size="sm">Alle abspielen</Button>
			{/snippet}
		</ViewHeader>
	</div>
</Story>
