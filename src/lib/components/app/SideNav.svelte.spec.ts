import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SideNav from './SideNav.svelte';

const base = {
	navigation: [
		{ href: '/app', label: 'Home' },
		{ href: '/app/search', label: 'Search' },
		{ href: '/app/library', label: 'Library' }
	],
	navigationLabel: 'Primary navigation'
};

describe('SideNav.svelte', () => {
	it('marks the current route with aria-current', async () => {
		render(SideNav, { ...base, currentPath: '/app/search' });
		const nav = page.getByRole('navigation', { name: 'Primary navigation' });
		await expect
			.element(nav.getByRole('link', { name: 'Search' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(nav.getByRole('link', { name: 'Home' }))
			.not.toHaveAttribute('aria-current');
	});

	it('renders the account link and a sign-out form when configured', async () => {
		render(SideNav, {
			...base,
			currentPath: '/app',
			userName: 'soulwax',
			accountHref: '/app/settings/tidal',
			accountLabel: 'Settings',
			signOutAction: '/logout',
			signOutLabel: 'Sign out'
		});
		await expect
			.element(page.getByRole('link', { name: /soulwax/ }))
			.toHaveAttribute('href', '/app/settings/tidal');
		await expect.element(page.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
	});

	it('keeps collapsed navigation accessible and exposes its expansion control', async () => {
		let toggles = 0;
		render(SideNav, {
			...base,
			currentPath: '/app',
			collapsed: true,
			onToggleRail: () => (toggles += 1),
			collapseRailLabel: 'Collapse navigation',
			expandRailLabel: 'Expand navigation'
		});

		await expect
			.element(
				page
					.getByRole('navigation', { name: 'Primary navigation' })
					.getByRole('link', { name: 'Library' })
			)
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Expand navigation' }).click();
		expect(toggles).toBe(1);
	});

	it('shows icons for account settings and sign-out when collapsed', async () => {
		render(SideNav, {
			...base,
			currentPath: '/app',
			userName: 'soulwax',
			accountHref: '/app/settings/tidal',
			accountLabel: 'Settings',
			signOutAction: '/logout',
			signOutLabel: 'Sign out',
			collapsed: true,
			onToggleRail: () => {},
			collapseRailLabel: 'Collapse navigation',
			expandRailLabel: 'Expand navigation'
		});

		// Both buttons should be accessible by title when collapsed (labels are hidden).
		await expect
			.element(page.getByRole('link', { name: /Settings/ }))
			.toHaveAttribute('title', 'Settings');
		await expect
			.element(page.getByRole('button', { name: /Sign out/ }))
			.toHaveAttribute('title', 'Sign out');
	});
});
