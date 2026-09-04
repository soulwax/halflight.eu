import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

describe('AppHeader.svelte', () => {
	it('renders logo linking to / and login button when user is logged out', async () => {
		render(AppHeader, { user: null });

		// Logo links to root when unauthenticated
		const logoLink = page.getByRole('link', { name: 'Syn' });
		await expect.element(logoLink).toHaveAttribute('href', '/');

		// Login button links to /sign-in
		const loginLink = page.getByRole('link', { name: 'Sign in' });
		await expect.element(loginLink).toBeInTheDocument();
		await expect.element(loginLink).toHaveAttribute('href', '/sign-in');

		// Sign out button should not be present
		await expect.element(page.getByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();

		// Style/Theme selector trigger is present
		const themeTrigger = page.getByRole('button', { name: /Current colour theme:/ });
		await expect.element(themeTrigger).toBeInTheDocument();
	});

	it('renders logo linking to /app and sign-out form when user is logged in', async () => {
		render(AppHeader, { user: { name: 'soulwax', email: 'soulwax@example.com' } });

		// Logo links to /app when authenticated
		const logoLink = page.getByRole('link', { name: 'Syn' });
		await expect.element(logoLink).toHaveAttribute('href', '/app');

		// Sign out button is present
		const signOutButton = page.getByRole('button', { name: 'Sign out' });
		await expect.element(signOutButton).toBeInTheDocument();

		// Login link should not be present
		await expect.element(page.getByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
	});
});
