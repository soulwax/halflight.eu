import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StateCard from './StateCard.svelte';
import { m } from '#lib/paraglide/messages.js';

describe('StateCard.svelte', () => {
	it('offers a connect action for not_connected when configured', async () => {
		render(StateCard, { state: 'not_connected', configured: true });
		await expect
			.element(page.getByRole('link', { name: m.home_connect_button() }))
			.toHaveAttribute('href', '/app/settings/tidal');
	});

	it('explains the missing configuration for not_connected when not configured', async () => {
		render(StateCard, { state: 'not_connected', configured: false });
		await expect.element(page.getByText(m.tidal_not_configured())).toBeInTheDocument();
	});

	it('offers reconnect + retry for authorization_expired', async () => {
		render(StateCard, { state: 'authorization_expired', retryHref: '/app/tracks/5' });
		await expect
			.element(page.getByRole('link', { name: m.tidal_reconnect() }))
			.toHaveAttribute('href', '/tidal/connect');
		await expect
			.element(page.getByRole('link', { name: m.track_retry() }))
			.toHaveAttribute('href', '/app/tracks/5');
	});

	it('sends not_found back to search', async () => {
		render(StateCard, { state: 'not_found' });
		await expect
			.element(page.getByRole('link', { name: m.track_back_to_search() }))
			.toHaveAttribute('href', '/app/search');
	});

	it('treats invalid_id like not_found', async () => {
		render(StateCard, { state: 'invalid_id' });
		await expect
			.element(page.getByRole('heading', { name: m.track_not_found_title() }))
			.toBeInTheDocument();
	});

	it('renders a retry-first layout for unavailable', async () => {
		render(StateCard, { state: 'unavailable' });
		await expect
			.element(page.getByRole('heading', { name: m.track_unavailable_title() }))
			.toBeInTheDocument();
	});

	it('renders a bare title/description card when no known state matches', async () => {
		render(StateCard, { title: 'Nothing here', description: 'Try a search' });
		await expect.element(page.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
		await expect.element(page.getByText('Try a search')).toBeInTheDocument();
	});
});
