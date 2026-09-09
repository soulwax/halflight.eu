import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

describe('AppHeader.svelte', () => {
	it('renders logo linking to / and login button when user is logged out', async () => {
		render(AppHeader, { user: null });

		// Logo links to root when unauthenticated
		const logoLink = page.getByRole('link', { name: 'Halflight' });
		await expect.element(logoLink).toHaveAttribute('href', '/');
		await expect
			.element(page.getByRole('img', { name: 'Halflight' }))
			.toHaveAttribute('src', '/icons/emily-the-strange-music-with-many-paths-64.png');

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
});
