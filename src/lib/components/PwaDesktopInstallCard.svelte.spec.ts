import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { installPromptState } from '#lib/mobile/install-prompt.svelte';
import { m } from '#lib/paraglide/messages.js';
import PwaDesktopInstallCard from './PwaDesktopInstallCard.svelte';

afterEach(() => {
	installPromptState.event = null;
});

describe('desktop PWA installation help', () => {
	it('offers browser-specific instructions and only confirms installation after appinstalled', async () => {
		installPromptState.event = null;
		render(PwaDesktopInstallCard);

		await expect
			.element(page.getByRole('heading', { name: m.desktop_pwa_title() }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.desktop_pwa_action() }))
			.not.toBeInTheDocument();
		await page.getByText(m.desktop_pwa_help_title()).click();
		await expect.element(page.getByText(m.desktop_pwa_help_chromium())).toBeInTheDocument();

		window.dispatchEvent(new Event('appinstalled'));
		await expect.element(page.getByRole('status')).toHaveTextContent(m.desktop_pwa_installed());
	});
});
