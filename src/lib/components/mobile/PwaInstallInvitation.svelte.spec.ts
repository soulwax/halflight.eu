import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import PwaInstallInvitation from './PwaInstallInvitation.svelte';

const DISMISSED_KEY = 'syn:pwa-install-invitation-dismissed';

afterEach(() => {
	player.hasQualifiedListen = false;
	localStorage.removeItem(DISMISSED_KEY);
});

describe('PWA installation invitation', () => {
	it('waits for a qualified listen and remembers dismissal', async () => {
		localStorage.removeItem(DISMISSED_KEY);
		player.hasQualifiedListen = false;
		render(PwaInstallInvitation);

		await expect.element(page.getByText(m.pwa_invitation_title())).not.toBeInTheDocument();
		player.hasQualifiedListen = true;
		await expect.element(page.getByText(m.pwa_invitation_title())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.pwa_invitation_settings() }))
			.toBeInTheDocument();

		await page.getByRole('button', { name: m.pwa_invitation_dismiss() }).click();
		await expect.element(page.getByText(m.pwa_invitation_title())).not.toBeInTheDocument();
		expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');

		render(PwaInstallInvitation);
		await expect.element(page.getByText(m.pwa_invitation_title())).not.toBeInTheDocument();
	});
});
