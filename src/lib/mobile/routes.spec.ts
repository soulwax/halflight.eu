import { describe, expect, it } from 'vitest';
import { isMobileRoute, isPublicMobileRoute } from './routes';

describe('isMobileRoute', () => {
	it('matches an exact mobile root path', () => {
		expect(isMobileRoute('/now')).toBe(true);
		expect(isMobileRoute('/home')).toBe(true);
		expect(isMobileRoute('/search')).toBe(true);
		expect(isMobileRoute('/library')).toBe(true);
		expect(isMobileRoute('/settings')).toBe(true);
		expect(isMobileRoute('/offline')).toBe(true);
	});

	it('matches a nested path under a mobile root', () => {
		expect(isMobileRoute('/now/queue')).toBe(true);
		expect(isMobileRoute('/albums/12345')).toBe(true);
	});

	it('matches localized mobile paths', () => {
		expect(isMobileRoute('/de-de/home')).toBe(true);
		expect(isMobileRoute('/de-de/now/queue')).toBe(true);
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

	it('marks only the offline recovery page as public', () => {
		expect(isPublicMobileRoute('/offline')).toBe(true);
		expect(isPublicMobileRoute('/offline/retry')).toBe(true);
		expect(isPublicMobileRoute('/de-de/offline')).toBe(true);
		expect(isPublicMobileRoute('/home')).toBe(false);
		expect(isPublicMobileRoute('/app')).toBe(false);
	});
});
