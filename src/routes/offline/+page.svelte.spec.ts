import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfflinePage from './+page.svelte';
import OfflineRecovery from '#lib/components/OfflineRecovery.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('offline recovery page', () => {
	it('offers neutral connection recovery without a session-dependent destination', async () => {
		render(OfflinePage);

		await expect
			.element(page.getByRole('heading', { name: m.offline_title() }))
			.toBeInTheDocument();
		await expect.element(page.getByText(m.offline_description())).toBeInTheDocument();
		const retry = page.getByRole('link', { name: m.offline_retry() });
		await expect.element(retry).toBeInTheDocument();
		await expect.element(retry).toHaveAttribute('href', '/home');
	});

	it('renders German recovery copy and a localized retry destination when requested', async () => {
		render(OfflineRecovery, { locale: 'de-de' });

		await expect
			.element(page.getByRole('heading', { name: m.offline_title({}, { locale: 'de-de' }) }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('main')).toHaveAttribute('lang', 'de-de');
		await expect
			.element(page.getByRole('link', { name: m.offline_retry({}, { locale: 'de-de' }) }))
			.toHaveAttribute('href', '/de-de/home');
	});

	it('renders desktop-specific recovery copy and returns to the desktop app', async () => {
		render(OfflineRecovery, { locale: 'de-de', app: 'desktop' });

		await expect
			.element(page.getByText(m.desktop_offline_description({}, { locale: 'de-de' })))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.offline_retry({}, { locale: 'de-de' }) }))
			.toHaveAttribute('href', '/de-de/app');
	});
});
