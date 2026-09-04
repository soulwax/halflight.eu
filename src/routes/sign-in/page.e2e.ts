import { expect, test } from '@playwright/test';

test('unauthenticated visitors are redirected from the app to sign-in', async ({ page }) => {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/sign-in$/);
});

test('the sign-in page renders the unified credential form', async ({ page }) => {
	await page.goto('/sign-in');

	await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Syn' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
	await expect(page.getByLabel('Password')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();

	// The name field only appears once "Create account" is selected; the shared
	// "Continue" submit button stays put underneath either mode.
	await expect(page.getByRole('textbox', { name: 'Name' })).not.toBeVisible();
	await page.getByRole('button', { name: 'Create account', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
});
