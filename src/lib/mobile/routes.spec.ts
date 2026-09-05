import { describe, expect, it } from 'vitest';
import { isMobileRoute } from './routes';

describe('isMobileRoute', () => {
	it('matches an exact mobile root path', () => {
		expect(isMobileRoute('/now')).toBe(true);
		expect(isMobileRoute('/home')).toBe(true);
		expect(isMobileRoute('/search')).toBe(true);
	});

	it('matches a nested path under a mobile root', () => {
		expect(isMobileRoute('/now/queue')).toBe(true);
	});

	it('does not match the desktop app or an unrelated path', () => {
		expect(isMobileRoute('/app')).toBe(false);
		expect(isMobileRoute('/app/library')).toBe(false);
		expect(isMobileRoute('/sign-in')).toBe(false);
	});

	it('does not match a path that merely starts with the same letters', () => {
		expect(isMobileRoute('/nowhere')).toBe(false);
		expect(isMobileRoute('/homepage')).toBe(false);
	});
});
