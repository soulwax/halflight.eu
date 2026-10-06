import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages';
import MobileError from './+error.svelte';

const state = vi.hoisted(() => ({
	page: { url: new URL('https://halflight.test/now/lyrics'), status: 500 }
}));
vi.mock('$app/state', () => state);
vi.mock('$app/navigation', () => ({ goto: vi.fn(() => Promise.resolve()) }));

describe('(mobile)/+error.svelte', () => {
	it('keeps a failed screen on Halflight Now and offers a retry', async () => {
		state.page.status = 500;
		render(MobileError);

		await expect
			.element(page.getByRole('heading', { level: 1, name: m.error_title() }))
			.toBeInTheDocument();
		await expect.element(page.getByText(m.now_error_description())).toBeInTheDocument();
		// Never the desktop Listening Room: the way out stays on the mobile site.
		await expect
			.element(page.getByRole('link', { name: m.now_error_home() }))
			.toHaveAttribute('href', '/home');
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
	});

	it('does not offer a pointless retry for a missing page', async () => {
		state.page.status = 404;
		render(MobileError);

		await expect.element(page.getByText(m.now_error_not_found())).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.track_retry() }))
			.not.toBeInTheDocument();
	});
});
