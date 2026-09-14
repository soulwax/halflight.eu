import { describe, expect, it } from 'vitest';

import { load } from './+layout.server';

describe('root layout server load', () => {
	it('keeps the offline recovery route public even for a signed-in visitor, but still themed', async () => {
		const result = await load({
			url: new URL('https://m.halflight.eu/offline'),
			locals: {
				user: { id: 'owner', name: 'Private owner', email: 'owner@example.com' },
				isAdministrator: true,
				isFirstAdministrator: true,
				theme: 'warm-night'
			}
		} as Parameters<typeof load>[0]);

		// hooks.server.ts already resolved the theme from the cookie for this
		// request, so the public fallback still carries it — it must never fall
		// back to the account.
		expect(result).toEqual({ user: null, theme: 'warm-night' });
	});

	it('passes through the theme hooks.server.ts resolved for an authenticated page', async () => {
		const result = await load({
			url: new URL('https://halflight.eu/app'),
			locals: {
				user: { id: 'owner', name: 'Private owner', email: 'owner@example.com' },
				isAdministrator: true,
				isFirstAdministrator: true,
				theme: 'electric'
			}
		} as Parameters<typeof load>[0]);

		expect(result).toMatchObject({ theme: 'electric' });
	});
});
