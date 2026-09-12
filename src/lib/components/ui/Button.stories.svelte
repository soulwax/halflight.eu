<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Button from './Button.svelte';

	const { Story } = defineMeta({
		title: 'UI/Button',
		component: Button,
		tags: ['autodocs'],
		argTypes: {
			variant: { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
			size: { control: 'select', options: ['sm', 'md', 'lg'] },
			disabled: { control: 'boolean' }
		},
		args: {
			variant: 'secondary',
			size: 'md',
			disabled: false
		}
	});
</script>

<Story name="Primary" args={{ variant: 'primary' }}>
	{#snippet template(args)}
		<Button {...args}>Generate My Set</Button>
	{/snippet}
</Story>

<Story name="Secondary" args={{ variant: 'secondary' }}>
	{#snippet template(args)}
		<Button {...args}>Cancel</Button>
	{/snippet}
</Story>

<Story name="Danger" args={{ variant: 'danger' }}>
	{#snippet template(args)}
		<Button {...args}>Delete playlist</Button>
	{/snippet}
</Story>

<Story name="Ghost" args={{ variant: 'ghost' }}>
	{#snippet template(args)}
		<Button {...args}>Generate</Button>
	{/snippet}
</Story>

<Story name="The three weights together" asChild>
	<!--
		The hierarchy this component exists to express. Ghost has no chrome at
		rest so the bordered secondary beside it still reads as the stronger
		offer, and primary carries the one action a view is asking for.
	-->
	<div style="display: flex; gap: 0.75rem; align-items: center;">
		<Button variant="ghost">See all mixes</Button>
		<Button variant="secondary">Import</Button>
		<Button variant="primary">Play all</Button>
	</div>
</Story>

<Story name="Sizes" asChild>
	<div style="display: flex; gap: 0.75rem; align-items: center;">
		<Button variant="primary" size="sm">Small</Button>
		<Button variant="primary" size="md">Medium</Button>
		<Button variant="primary" size="lg">Large</Button>
	</div>
</Story>

<Story name="Disabled" args={{ variant: 'primary', disabled: true }}>
	{#snippet template(args)}
		<Button {...args}>Generate My Set</Button>
	{/snippet}
</Story>

<Story name="As a link" asChild>
	<Button href="/app/generate" variant="primary">Open Generate</Button>
</Story>
