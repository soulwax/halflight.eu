import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUserSettings: vi.fn() }));

vi.mock('#lib/server/user-settings', () => ({ getUserSettings: mocks.getUserSettings }));

import { load } from './+layout.server';

describe('root layout server load', () => {
	beforeEach(() => {
		mocks.getUserSettings.mockReset();
	});

	it('keeps the offline recovery route public even for a signed-in visitor', async () => {
		const result = await load({
			url: new URL('https://m.halflight.eu/offline'),
			locals: {
				user: { id: 'owner', name: 'Private owner', email: 'owner@example.com' },
				isAdministrator: true,
				isFirstAdministrator: true
			}
		} as Parameters<typeof load>[0]);

		expect(result).toEqual({ user: null, theme: null, visualStyle: null });
		expect(mocks.getUserSettings).not.toHaveBeenCalled();
	});
});
