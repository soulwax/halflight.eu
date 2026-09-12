<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SectionHeader from './SectionHeader.svelte';
	import Button from './Button.svelte';

	const { Story } = defineMeta({
		title: 'UI/SectionHeader',
		component: SectionHeader,
		tags: ['autodocs'],
		args: {
			title: 'Recently Played'
		}
	});
</script>

<Story name="Title only" />

<Story name="With a count" args={{ title: 'My Custom Playlists', count: 12 }} />

<Story
	name="With an eyebrow and subtitle"
	args={{
		eyebrow: 'Made for this moment',
		title: 'A Set For Right Now',
		subtitle: 'Start with your taste, then make the set your own before you save it.'
	}}
/>

<Story name="With actions">
	{#snippet template(args)}
		<SectionHeader {...args}>
			{#snippet actions()}
				<Button variant="secondary" size="sm">Import</Button>
				<Button variant="secondary" size="sm">Sync all</Button>
			{/snippet}
		</SectionHeader>
	{/snippet}
</Story>

<Story name="Long German title wraps without breaking the actions row" asChild>
	<!--
		The Definition of done requires checking German layout specifically —
		its strings run 15-30% longer than English on average. This is the shape
		that stresses the header's wrap behaviour most: a long eyebrow and title
		alongside two action buttons at a narrow width.
	-->
	<div style="max-width: 22rem;">
		<SectionHeader
			eyebrow="Für diesen Moment gemacht"
			title="Meine eigenen Playlists und gespeicherten Titel"
			count={128}
		>
			{#snippet actions()}
				<Button variant="secondary" size="sm">Importieren</Button>
				<Button variant="secondary" size="sm">Alle synchronisieren</Button>
			{/snippet}
		</SectionHeader>
	</div>
</Story>
