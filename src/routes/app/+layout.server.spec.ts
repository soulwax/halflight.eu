import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadSessionShellData: vi.fn() }));

vi.mock('#lib/server/session-shell', () => ({ loadSessionShellData: mocks.loadSessionShellData }));

import { load } from './+layout.server';

function event(isListener = true) {
	return {
		locals: {
			user: { id: 'owner-1', name: 'Owner', email: 'owner@example.test' },
			isListener,
			isAdministrator: false
		},
		fetch: vi.fn(),
		url: new URL('https://halflight.test/app/search?q=night'),
		cookies: {}
	} as unknown as Parameters<typeof load>[0];
}

describe('/app +layout.server', () => {
	beforeEach(() => mocks.loadSessionShellData.mockReset());

	it('loads the desktop shell for the owner', async () => {
		mocks.loadSessionShellData.mockResolvedValue({ playback: null });

		const result = await load(event());

		expect(result).toMatchObject({ user: { name: 'Owner', isAdministrator: false } });
		expect(mocks.loadSessionShellData).toHaveBeenCalledOnce();
	});

	it('redirects a signed-in non-owner before loading owner session data', async () => {
		await expect(load(event(false))).rejects.toMatchObject({
			status: 302,
			location: '/sign-in?returnTo=%2Fapp%2Fsearch%3Fq%3Dnight'
		});
		expect(mocks.loadSessionShellData).not.toHaveBeenCalled();
	});
});
