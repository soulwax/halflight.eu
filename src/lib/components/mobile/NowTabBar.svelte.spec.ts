import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowTabBar from './NowTabBar.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('NowTabBar.svelte', () => {
	it('keeps Search and Library as the labelled mobile destinations', async () => {
		render(NowTabBar, { currentPath: '/home' });

		const search = page.getByRole('link', { name: m.now_tab_search() });
		const library = page.getByRole('link', { name: m.now_tab_library() });
		await expect.element(search).toBeInTheDocument();
		await expect.element(library).toBeInTheDocument();
		expect(search.element().textContent?.trim()).toBe(m.now_tab_search());
		expect(library.element().textContent?.trim()).toBe(m.now_tab_library());
		expect(search.element().getAttribute('href')).toBe('/search');
		expect(library.element().getAttribute('href')).toBe('/library');
	});

	it('marks the active tab with aria-current', async () => {
		render(NowTabBar, { currentPath: '/library' });

		expect(
			page.getByRole('link', { name: m.now_tab_library() }).element().getAttribute('aria-current')
		).toBe('page');
		expect(
			page.getByRole('link', { name: m.now_tab_search() }).element().getAttribute('aria-current')
		).toBeNull();
	});
});
