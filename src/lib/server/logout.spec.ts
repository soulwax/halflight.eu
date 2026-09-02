import { describe, expect, it, vi } from 'vitest';
import { purgeCookies } from './logout';

describe('purgeCookies', () => {
	it('clears every available cookie and the pending TIDAL OAuth cookie on every app path', () => {
		const cookies = {
			getAll: vi.fn(() => [
				{ name: 'better-auth.session_token', value: 'redacted' },
				{ name: 'paraglide', value: 'en' }
			]),
			delete: vi.fn()
		};

		purgeCookies(cookies as never);

		expect(cookies.delete).toHaveBeenCalledTimes(9);
		expect(cookies.delete).toHaveBeenCalledWith('better-auth.session_token', { path: '/' });
		expect(cookies.delete).toHaveBeenCalledWith('paraglide', { path: '/api/auth' });
		expect(cookies.delete).toHaveBeenCalledWith('tidal_oauth', { path: '/tidal' });
	});
});
