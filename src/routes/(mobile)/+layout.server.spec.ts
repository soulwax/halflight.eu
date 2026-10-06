import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadSessionShellData: vi.fn() }));

vi.mock('#lib/server/session-shell', () => ({ loadSessionShellData: mocks.loadSessionShellData }));

import { load } from './+layout.server';

function event(isListener = true) {
	return {
		locals: { user: { id: 'owner-1' }, isListener },
		fetch: vi.fn(),
		url: new URL('https://halflight.test/search?q=night'),
		cookies: {}
	} as unknown as Parameters<typeof load>[0];
}

describe('/(mobile) +layout.server', () => {
	beforeEach(() => mocks.loadSessionShellData.mockReset());

	it('loads the mobile shell for the owner', async () => {
		mocks.loadSessionShellData.mockResolvedValue({ playback: null });

		await expect(load(event())).resolves.toEqual({ playback: null });
		expect(mocks.loadSessionShellData).toHaveBeenCalledOnce();
	});

	it('redirects a signed-in non-owner before loading owner session data', async () => {
		await expect(load(event(false))).rejects.toMatchObject({
			status: 302,
			location: '/sign-in?returnTo=%2Fsearch%3Fq%3Dnight'
		});
		expect(mocks.loadSessionShellData).not.toHaveBeenCalled();
	});
});
