import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility audits', () => {
	test('sign-in page has zero axe violations', async ({ page }) => {
		await page.goto('/sign-in');
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});
