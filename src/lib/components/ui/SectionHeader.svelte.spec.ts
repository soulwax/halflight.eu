import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import SectionHeader from './SectionHeader.svelte';

describe('SectionHeader.svelte', () => {
	it('renders the title as a heading with the given id', async () => {
		render(SectionHeader, { title: 'Album Review', titleId: 'album-review-title' });
		const heading = page.getByRole('heading', { name: 'Album Review' });
		await expect.element(heading).toHaveAttribute('id', 'album-review-title');
	});

	it('shows the eyebrow, subtitle and count when provided', async () => {
		render(SectionHeader, {
			title: 'Tracks',
			eyebrow: 'SYN // LIBRARY',
			subtitle: 'Everything you saved',
			count: 42
		});
		await expect.element(page.getByText('SYN // LIBRARY')).toBeInTheDocument();
		await expect.element(page.getByText('Everything you saved')).toBeInTheDocument();
		await expect.element(page.getByText('(42)')).toBeInTheDocument();
	});

	it('renders the actions snippet', async () => {
		render(SectionHeader, {
			title: 'Tracks',
			actions: createRawSnippet(() => ({ render: () => '<button type="button">Play all</button>' }))
		});
		await expect.element(page.getByRole('button', { name: 'Play all' })).toBeInTheDocument();
	});
});
