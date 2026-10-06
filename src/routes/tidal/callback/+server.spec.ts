import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ exchangeCode: vi.fn(), writeRecord: vi.fn() }));
vi.mock('#lib/server/tidal', () => ({
	exchangeCode: mocks.exchangeCode,
	writeRecord: mocks.writeRecord,
	TidalError: class extends Error {}
}));
import { GET } from './+server';
function event(query: string, returnTo = '/settings') {
	return {
		locals: { user: { id: 'owner' }, isListener: true },
		url: new URL('https://halflight.test/tidal/callback?' + query),
		cookies: {
			get: () =>
				JSON.stringify({ state: 'valid-state', verifier: 'pkce', userId: 'owner', returnTo }),
			delete: vi.fn()
		} as unknown as Cookies,
		fetch: vi.fn()
	} as unknown as Parameters<typeof GET>[0];
}
beforeEach(() => {
	mocks.exchangeCode.mockReset().mockResolvedValue({});
	mocks.writeRecord.mockReset();
});
describe('TIDAL callback settings return', () => {
	it('returns a successful mobile connection to mobile settings', async () => {
		await expect(GET(event('code=code&state=valid-state'))).rejects.toMatchObject({
			status: 303,
			location: '/settings?connected=1'
		});
		expect(mocks.exchangeCode).toHaveBeenCalledWith(
			{ code: 'code', verifier: 'pkce' },
			expect.any(Function)
		);
		expect(mocks.writeRecord).toHaveBeenCalledOnce();
	});
	it('rejects bad state without exchanging or persisting a token', async () => {
		await expect(GET(event('code=code&state=wrong'))).rejects.toMatchObject({
			location: '/settings?error=state_mismatch'
		});
		expect(mocks.exchangeCode).not.toHaveBeenCalled();
		expect(mocks.writeRecord).not.toHaveBeenCalled();
	});
	it('uses an allowlisted destination and never reflects a provider error description', async () => {
		await expect(
			GET(event('error=denied&error_description=private-value', '//evil.test'))
		).rejects.toMatchObject({ location: '/app/settings/tidal?error=authorization_denied' });
		expect(mocks.exchangeCode).not.toHaveBeenCalled();
	});
});
