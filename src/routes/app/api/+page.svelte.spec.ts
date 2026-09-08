import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ApiReferencePage from './+page.svelte';

describe('/app/api', () => {
	it('presents owner API operations and keeps write endpoints reference-only', async () => {
		render(ApiReferencePage);

		await expect.element(page.getByRole('heading', { name: 'API workbench' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: /List private music/ }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Download OpenAPI JSON' }))
			.toHaveAttribute('href', '/api/openapi.json');
		await expect.element(page.getByRole('button', { name: 'Send request' })).toBeInTheDocument();

		await page.getByRole('button', { name: /Create a custom playlist/ }).click();
		await expect
			.element(page.getByText('Mutating operations are documented here'))
			.toBeInTheDocument();
	});
});
