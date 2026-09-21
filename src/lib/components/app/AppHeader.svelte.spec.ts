import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

const navigation = [
	{ href: '/app', label: 'Home' },
	{ href: '/app/search', label: 'Search' },
	{ href: '/app/library', label: 'Library' },
	{ href: '/app/mixes', label: 'Mixes' }
];

describe('AppHeader.svelte', () => {
	it('renders the wordmark linking to / and login button when user is logged out', async () => {
		render(AppHeader, { user: null });

		// Logo links to root when unauthenticated
		const logoLink = page.getByRole('link', { name: 'Halflight' });
		await expect.element(logoLink).toHaveAttribute('href', '/');
		await expect.element(logoLink).toHaveTextContent('Halflight');

		// Login button links to /sign-in
		const loginLink = page.getByRole('link', { name: 'Sign in' });
		await expect.element(loginLink).toBeInTheDocument();
		await expect.element(loginLink).toHaveAttribute('href', '/sign-in');

		// Sign out button should not be present
		await expect.element(page.getByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();

		// Settings icon button links to /app/settings/tidal
		const settingsLink = page.getByRole('link', { name: 'Settings' });
		await expect.element(settingsLink).toBeInTheDocument();
		await expect.element(settingsLink).toHaveAttribute('href', '/app/settings/tidal');

		await expect
			.element(page.getByRole('combobox', { name: 'Search Halflight' }))
			.not.toBeInTheDocument();
	});

	it('renders logo linking to /app and sign-out form when user is logged in', async () => {
		render(AppHeader, { user: { name: 'soulwax', email: 'soulwax@example.com' } });

		// Logo links to /app when authenticated
		const logoLink = page.getByRole('link', { name: 'Halflight' });
		await expect.element(logoLink).toHaveAttribute('href', '/app');

		// Sign out button is present
		const signOutButton = page.getByRole('button', { name: 'Sign out' });
		await expect.element(signOutButton).toBeInTheDocument();

		// Login link should not be present
		await expect.element(page.getByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();

		// Settings icon button links to /app/settings/tidal
		const settingsLink = page.getByRole('link', { name: 'Settings' });
		await expect.element(settingsLink).toBeInTheDocument();
		await expect.element(settingsLink).toHaveAttribute('href', '/app/settings/tidal');

		await expect
			.element(page.getByRole('combobox', { name: 'Search Halflight' }))
			.toBeInTheDocument();

		// Admin button should NOT be present for non-admin
		await expect
			.element(page.getByRole('link', { name: 'Administration' }))
			.not.toBeInTheDocument();
	});

	it('renders the administration and settings actions for an administrator', async () => {
		render(AppHeader, {
			user: {
				name: 'soulwax',
				email: 'soulwax@example.com',
				isAdministrator: true
			}
		});

		// Admin icon button links to /app/admin
		const adminLink = page.getByRole('link', { name: 'Administration' });
		await expect.element(adminLink).toBeInTheDocument();
		await expect.element(adminLink).toHaveAttribute('href', '/app/admin');

		// Settings icon button is also present
		const settingsLink = page.getByRole('link', { name: 'Settings' });
		await expect.element(settingsLink).toBeInTheDocument();
	});

	it('lets a dedicated search view own the only search field', async () => {
		render(AppHeader, {
			user: { name: 'soulwax', email: 'soulwax@example.com' },
			showSearch: false
		});

		await expect
			.element(page.getByRole('combobox', { name: 'Search Halflight' }))
			.not.toBeInTheDocument();
	});

	describe('at phone width', () => {
		afterEach(async () => {
			await page.viewport(1280, 900);
		});

		it('keeps search and library as header symbols and moves the rest into the menu', async () => {
			await page.viewport(390, 844);
			render(AppHeader, {
				user: { name: 'soulwax', email: 'soulwax@example.com' },
				navigation,
				currentPath: '/app/library'
			});

			await expect
				.element(page.getByRole('link', { name: 'Search' }))
				.toHaveAttribute('href', '/app/search');
			await expect
				.element(page.getByRole('link', { name: 'Library' }))
				.toHaveAttribute('aria-current', 'page');
			await expect.element(page.getByRole('link', { name: 'Mixes' })).not.toBeInTheDocument();

			await page.getByRole('button', { name: 'Mobile navigation' }).click();

			const menu = page.getByRole('dialog');
			await expect.element(menu.getByRole('link', { name: 'Mixes' })).toBeInTheDocument();
			await expect
				.element(menu.getByRole('link', { name: 'Library' }))
				.toHaveAttribute('aria-current', 'page');
		});

		it('offers settings, sign out and (for administrators) administration in the menu', async () => {
			await page.viewport(390, 844);
			render(AppHeader, {
				user: { name: 'soulwax', email: 'soulwax@example.com', isAdministrator: true },
				navigation,
				currentPath: '/app',
				accountHref: '/app/settings/tidal',
				accountLabel: 'Settings',
				signOutAction: '/logout',
				signOutLabel: 'Sign out'
			});

			await page.getByRole('button', { name: 'Mobile navigation' }).click();

			const menu = page.getByRole('dialog');
			await expect
				.element(menu.getByRole('link', { name: 'Administration' }))
				.toHaveAttribute('href', '/app/admin');
			await expect
				.element(menu.getByRole('link', { name: 'Settings' }))
				.toHaveAttribute('href', '/app/settings/tidal');
			await expect.element(menu.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
		});

		it('closes the menu after following a destination', async () => {
			await page.viewport(390, 844);
			render(AppHeader, {
				user: { name: 'soulwax', email: 'soulwax@example.com' },
				navigation,
				currentPath: '/app'
			});

			await page.getByRole('button', { name: 'Mobile navigation' }).click();
			const menu = page.getByRole('dialog');
			// Keep the click inside the document so the test page is not navigated away.
			menu
				.getByRole('link', { name: 'Mixes' })
				.element()
				.addEventListener('click', (event) => {
					event.preventDefault();
				});
			await menu.getByRole('link', { name: 'Mixes' }).click();

			await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		});
	});
});
