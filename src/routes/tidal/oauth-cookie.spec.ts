import { describe, expect, it } from 'vitest';
import { tidalReturnTo } from './oauth-cookie';

describe('TIDAL setup destination', () => {
	it('accepts only the two settings destinations', () => {
		expect(tidalReturnTo('/settings')).toBe('/settings');
		expect(tidalReturnTo('/app/settings/tidal')).toBe('/app/settings/tidal');
		for (const value of [
			null,
			'',
			'//evil.test',
			'https://evil.test/settings',
			'/settings?next=https://evil.test',
			'/sign-in',
			'/settings/../app'
		]) {
			expect(tidalReturnTo(value)).toBe('/app/settings/tidal');
		}
	});
});
