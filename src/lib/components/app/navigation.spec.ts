import { describe, expect, it } from 'vitest';
import { isCurrentNavigationItem } from './navigation';

const home = { href: '/app', label: 'Home' };
const search = { href: '/app/search', label: 'Search' };
const settings = { href: '/app/settings/tidal', label: 'Settings' };

describe('isCurrentNavigationItem', () => {
	it('matches the item whose href equals the current path', () => {
		expect(isCurrentNavigationItem(home, '/app')).toBe(true);
		expect(isCurrentNavigationItem(search, '/app/search')).toBe(true);
	});

	it('activates a section from its sub-pages', () => {
		expect(isCurrentNavigationItem(search, '/app/search/results')).toBe(true);
		expect(isCurrentNavigationItem(settings, '/app/settings/tidal/callback')).toBe(true);
	});

	it('does not let the section-root item swallow every sub-route', () => {
		expect(isCurrentNavigationItem(home, '/app/search')).toBe(false);
		expect(isCurrentNavigationItem(home, '/app/library')).toBe(false);
	});

	it('honours an explicit `current` override', () => {
		expect(isCurrentNavigationItem({ ...home, current: true }, '/somewhere/else')).toBe(true);
		expect(isCurrentNavigationItem({ ...search, current: false }, '/app/search')).toBe(false);
	});
});
