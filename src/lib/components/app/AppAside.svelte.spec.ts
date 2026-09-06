import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import AppAside from './AppAside.svelte';

describe('AppAside', () => {
	it('composes a labelled context region with route-owned content and actions', async () => {
		const snippet = (markup: string) => createRawSnippet(() => ({ render: () => markup }));

		render(AppAside, {
			title: 'Queue',
			description: 'What plays next',
			actions: snippet('<button type="button">Clear</button>'),
			children: snippet('<p>Track one</p>')
		});

		await expect.element(page.getByRole('region', { name: 'Queue' })).toBeInTheDocument();
		await expect.element(page.getByText('What plays next')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
		await expect.element(page.getByText('Track one')).toBeInTheDocument();
	});
});
