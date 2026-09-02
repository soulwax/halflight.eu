import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Footer from './Footer.svelte';
import { APP_VERSION } from '#lib/version';
import { m } from '#lib/paraglide/messages.js';

describe('Footer.svelte', () => {
	it('renders the 10px footer with version, copyright and legal text', async () => {
		render(Footer);

		const expectedText = m.footer_text({ version: APP_VERSION });

		const footer = page.getByRole('contentinfo');
		await expect.element(footer).toBeInTheDocument();
		await expect.element(footer).toHaveTextContent(expectedText);
		await expect.element(footer).toHaveClass('h-[10px]');
	});
});
