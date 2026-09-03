import { expect, test } from '@playwright/test';

test('unauthenticated visitors are redirected from the app to sign-in', async ({ page }) => {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/sign-in$/);
});

test('the sign-in page renders the administrator credential form', async ({ page }) => {
	await page.goto('/sign-in');

	await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Syn' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
	await expect(page.getByLabel('Password')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
});
