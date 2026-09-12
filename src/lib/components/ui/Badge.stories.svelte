<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Badge from './Badge.svelte';

	const { Story } = defineMeta({
		title: 'UI/Badge',
		component: Badge,
		tags: ['autodocs'],
		argTypes: {
			variant: { control: 'select', options: ['quality', 'explicit', 'accent', 'tag'] },
			text: { control: 'text' },
			title: { control: 'text' }
		}
	});
</script>

<Story name="Quality tiers" asChild>
	<!-- The visible fidelity ladder: `data-tier` drives colour from `qualityTier(text)`. -->
	<div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
		<Badge variant="quality" text="LOW" />
		<Badge variant="quality" text="HIGH" />
		<Badge variant="quality" text="LOSSLESS" />
		<Badge variant="quality" text="HI_RES_LOSSLESS" />
	</div>
</Story>

<Story name="Explicit" args={{ variant: 'explicit' }} />

<Story
	name="Explicit with custom title"
	args={{ variant: 'explicit', title: 'Contains explicit lyrics' }}
/>

<Story name="Accent" args={{ variant: 'accent', text: 'NEW' }} />

<Story name="Underscored text is humanised" args={{ variant: 'accent', text: 'RECENTLY_ADDED' }} />

<Story name="Tag" args={{ variant: 'tag', text: 'Initial confidence' }} />

<Story name="Tag next to the high-confidence Accent it stands in for" asChild>
	<!--
		The one real call site — taste/+page.svelte's confidence badge — picks
		between these two by a single condition: `accent` for "high" confidence,
		`tag` for every other level. `tag` renders muted rather than a design
		decision made here; see the comment on Badge's template.
	-->
	<div style="display: flex; gap: 0.5rem; align-items: center;">
		<Badge variant="accent" text="High confidence" />
		<Badge variant="tag" text="Good confidence" />
	</div>
</Story>
