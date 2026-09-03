import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileNav from './MobileNav.svelte';

describe('MobileNav.svelte', () => {
	it('renders a labelled bottom nav and flags the active route', async () => {
		render(MobileNav, {
			navigation: [
				{ href: '/app', label: 'Home' },
				{ href: '/app/mixes', label: 'Mixes' }
			],
			currentPath: '/app/mixes',
			navigationLabel: 'Primary navigation'
		});
		const nav = page.getByRole('navigation', { name: 'Primary navigation' });
		await expect
			.element(nav.getByRole('link', { name: 'Mixes' }))
			.toHaveAttribute('aria-current', 'page');
	});

	it('renders a sign-out submit button when an action is supplied', async () => {
		render(MobileNav, {
			navigation: [{ href: '/app', label: 'Home' }],
			currentPath: '/app',
			navigationLabel: 'Primary navigation',
			signOutAction: '/logout',
			signOutLabel: 'Sign out'
		});
		await expect.element(page.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
	});
});
