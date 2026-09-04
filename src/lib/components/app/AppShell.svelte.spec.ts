import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import AppShell from './AppShell.svelte';

describe('AppShell', () => {
	it('provides a skip link, labelled navigation, and the current page', async () => {
		render(AppShell, {
			navigation: [
				{ href: '/app', label: 'Home' },
				{ href: '/app/search', label: 'Search' }
			],
			currentPath: '/app/search',
			skipLinkLabel: 'Skip to main content',
			navigationLabel: 'Primary navigation',
			children: createRawSnippet(() => ({ render: () => '<h1>Search</h1>' }))
		});

		await expect
			.element(page.getByRole('link', { name: 'Skip to main content' }))
			.toHaveAttribute('href', '#main-content');
		await expect.element(page.getByRole('main')).toHaveAttribute('id', 'main-content');
		await expect
			.element(
				page
					.getByRole('navigation', { name: 'Primary navigation' })
					.getByRole('link', { name: 'Search' })
					.first()
			)
			.toHaveAttribute('aria-current', 'page');
	});
});
