import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfflinePage from './+page.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('offline recovery page', () => {
	it('offers neutral connection recovery without a session-dependent destination', async () => {
		render(OfflinePage);

		await expect
			.element(page.getByRole('heading', { name: m.offline_title() }))
			.toBeInTheDocument();
		await expect.element(page.getByText(m.offline_description())).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: m.offline_retry() })).toBeInTheDocument();
	});
});
