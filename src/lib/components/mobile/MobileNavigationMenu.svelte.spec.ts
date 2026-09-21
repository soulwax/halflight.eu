import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileNavigationMenu from './MobileNavigationMenu.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('MobileNavigationMenu.svelte', () => {
	it('keeps the complete navigation behind an accessible hamburger menu', async () => {
		render(MobileNavigationMenu, { currentPath: '/library' });

		const trigger = page.getByRole('button', { name: m.nav_mobile() });
		await expect.element(trigger).toBeInTheDocument();
		await trigger.click();

		const menu = page.getByRole('navigation', { name: m.nav_primary() });
		await expect.element(menu).toBeInTheDocument();
		await expect.element(menu.getByRole('link', { name: m.now_tab_home() })).toBeInTheDocument();
		await expect.element(menu.getByRole('link', { name: m.now_tab_search() })).toBeInTheDocument();
		await expect
			.element(menu.getByRole('link', { name: m.now_tab_library() }))
			.toHaveAttribute('aria-current', 'page');
		await expect.element(menu.getByRole('link', { name: m.now_tab_now() })).toBeInTheDocument();
		await expect
			.element(menu.getByRole('link', { name: m.mobile_settings_title() }))
			.toBeInTheDocument();
	});
});
