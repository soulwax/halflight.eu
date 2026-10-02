import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TidalDebugTokens from './TidalDebugTokens.svelte';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

const bundle = {
	browse: {
		accessToken: 'account-access',
		refreshToken: 'account-refresh',
		tokenType: 'Bearer',
		scopes: ['user.read'],
		expiresAt: '2026-10-03T12:00:00.000Z'
	},
	playback: null
};

describe('TidalDebugTokens.svelte', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
		else Reflect.deleteProperty(navigator, 'clipboard');
	});

	it('fetches values only after an explicit reveal and clears them when hidden', async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json(bundle));
		vi.stubGlobal('fetch', fetchMock);
		render(TidalDebugTokens);

		expect(fetchMock).not.toHaveBeenCalled();
		await page.getByRole('button', { name: 'Show account values' }).click();
		await expect.element(page.getByLabelText('Access token')).toHaveValue('account-access');
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/tidal/debug-tokens',
			expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' })
		);

		await page.getByRole('button', { name: 'Hide values' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Show account values' }))
			.toBeInTheDocument();
		expect(page.getByLabelText('Access token')).not.toBeInTheDocument();
	});

	it('copies the selected account token on request', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(bundle)));
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		});
		render(TidalDebugTokens);

		await page.getByRole('button', { name: 'Show account values' }).click();
		await page.getByRole('button', { name: 'Copy' }).first().click();
		expect(writeText).toHaveBeenCalledWith('account-access');
		await expect.element(page.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
	});
});
