import { describe, expect, it } from 'vitest';

import { load } from './+layout.server';

describe('root layout server load', () => {
	it('keeps the offline recovery route public even for a signed-in visitor', async () => {
		const result = await load({
			url: new URL('https://m.halflight.eu/offline'),
			locals: {
				user: { id: 'owner', name: 'Private owner', email: 'owner@example.com' },
				isAdministrator: true,
				isFirstAdministrator: true
			}
		} as Parameters<typeof load>[0]);

		expect(result).toEqual({ user: null });
	});
});
