import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowTabBar from './NowTabBar.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('NowTabBar.svelte', () => {
	it('exposes Home and Now Playing destinations', async () => {
		render(NowTabBar, { currentPath: '/home' });

		const home = page.getByRole('link', { name: m.now_tab_home() });
		const now = page.getByRole('link', { name: m.now_tab_now() });
		await expect.element(home).toBeInTheDocument();
		await expect.element(now).toBeInTheDocument();
		expect(home.element().getAttribute('href')).toBe('/home');
		expect(now.element().getAttribute('href')).toBe('/now');
	});

	it('marks the active tab with aria-current', async () => {
		render(NowTabBar, { currentPath: '/now' });

		expect(
			page.getByRole('link', { name: m.now_tab_now() }).element().getAttribute('aria-current')
		).toBe('page');
		expect(
			page.getByRole('link', { name: m.now_tab_home() }).element().getAttribute('aria-current')
		).toBeNull();
	});
});
