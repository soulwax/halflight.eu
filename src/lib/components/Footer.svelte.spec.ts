import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Footer from './Footer.svelte';
import { APP_VERSION } from '#lib/version';

describe('Footer.svelte', () => {
	it('renders the 10px footer with version, copyright and legal text', async () => {
		render(Footer);

		const expectedText = `${APP_VERSION} - Copyright Bluesix Team 2026 All Rights Reserved - Tidal Reserves Their Own Rights, So Does Github under their country's jurisdictions`;

		const footer = page.getByRole('contentinfo');
		await expect.element(footer).toBeInTheDocument();
		await expect.element(footer).toHaveTextContent(expectedText);
		await expect.element(footer).toHaveClass('h-[10px]');
	});
});
