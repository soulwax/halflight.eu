import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import PageHeader from './PageHeader.svelte';

describe('PageHeader.svelte', () => {
	it('renders the title as an h1 with the eyebrow', async () => {
		render(PageHeader, { title: 'Random Access Memories', eyebrow: 'SYN // ALBUM' });
		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Random Access Memories' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('SYN // ALBUM')).toBeInTheDocument();
	});

	it('shows the cover image with descriptive alt text when given a url', async () => {
		render(PageHeader, { title: 'Discovery', imageUrl: 'https://img.test/cover.jpg' });
		await expect
			.element(page.getByRole('img', { name: 'Cover for Discovery' }))
			.toHaveAttribute('src', 'https://img.test/cover.jpg');
	});

	it('renders children and actions snippets', async () => {
		render(PageHeader, {
			title: 'Discovery',
			children: createRawSnippet(() => ({ render: () => '<p>2001</p>' })),
			actions: createRawSnippet(() => ({ render: () => '<button type="button">Play</button>' }))
		});
		await expect.element(page.getByText('2001')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeInTheDocument();
	});
});
