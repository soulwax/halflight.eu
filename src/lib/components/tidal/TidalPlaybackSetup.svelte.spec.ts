import { page } from 'vitest/browser';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TidalPlaybackSetup from './TidalPlaybackSetup.svelte';
import { m } from '#lib/paraglide/messages';
afterEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(() => Promise.reject(new Error('fetch disabled in component tests')))
	);
});
it('waits for authorization, accepts a TIDAL HTTPS link and cancels polling on close', async () => {
	const fetch = vi.fn(async () =>
		Response.json({
			deviceCode: 'ephemeral-code',
			userCode: 'ABCD',
			expiresIn: 60,
			interval: 2,
			verificationUriComplete: 'link.tidal.com/ABCD'
		})
	);
	vi.stubGlobal('fetch', fetch);
	await render(TidalPlaybackSetup, { configured: true, hasPlayback: false });
	await page.getByRole('button', { name: m.tidal_device_auth_btn() }).click();
	await expect
		.element(page.getByRole('link', { name: m.tidal_device_auth_open() }))
		.toHaveAttribute('href', 'https://link.tidal.com/ABCD');
	await expect.element(page.getByText(m.tidal_device_auth_waiting())).toBeInTheDocument();
	await page.getByRole('button', { name: m.playlist_cancel() }).click();
	await expect.element(page.getByText(m.tidal_device_auth_waiting())).not.toBeInTheDocument();
	expect(fetch).toHaveBeenCalledOnce();
	expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
});
it('never accepts an external verification destination', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () =>
			Response.json({
				deviceCode: 'ephemeral-code',
				userCode: 'ABCD',
				expiresIn: 60,
				interval: 2,
				verificationUriComplete: 'evil.test/ABCD'
			})
		)
	);
	await render(TidalPlaybackSetup, { configured: true });
	await page.getByRole('button', { name: m.tidal_device_auth_btn() }).click();
	await expect.element(page.getByText(m.tidal_device_auth_waiting())).toBeInTheDocument();
	await expect
		.element(page.getByRole('link', { name: m.tidal_device_auth_open() }))
		.not.toBeInTheDocument();
	await page.getByRole('button', { name: m.playlist_cancel() }).click();
});

it('expires a pending authorization and aborts further requests', async () => {
	const fetch = vi.fn(async () =>
		Response.json({
			deviceCode: 'ephemeral-code',
			userCode: 'ABCD',
			expiresIn: 1,
			interval: 2,
			verificationUriComplete: 'link.tidal.com/ABCD'
		})
	);
	vi.stubGlobal('fetch', fetch);
	await render(TidalPlaybackSetup, { configured: true });
	await page.getByRole('button', { name: m.tidal_device_auth_btn() }).click();
	await expect.element(page.getByRole('alert')).toHaveTextContent(m.tidal_device_auth_error());
	expect(fetch).toHaveBeenCalledOnce();
	expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
});
