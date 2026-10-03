import { describe, expect, it } from 'vitest';
import {
	managesMobileScroll,
	mobileScrollKey,
	shouldFocusMobileDestination,
	rememberMobileDetailReturn,
	mobilePlayerReturnTarget,
	isNowRoute
} from './navigation';

const url = (path: string) => new URL(path, 'https://m.halflight.test');

describe('mobile navigation state', () => {
	it('keys scroll restoration by the path and URL-backed controls', () => {
		expect(mobileScrollKey(url('/library?tab=tracks#favorites'))).toBe('/library?tab=tracks');
	});

	it('manages a full navigation inside Halflight Now', () => {
		expect(
			managesMobileScroll({ from: url('/home'), to: url('/library?tab=saved'), shallow: false })
		).toBe(true);
	});

	it('leaves shallow updates, fragments, and other sites to the router', () => {
		expect(
			managesMobileScroll({
				from: url('/search?q=ambient'),
				to: url('/search?q=ambient'),
				shallow: true
			})
		).toBe(false);
		expect(
			managesMobileScroll({ from: url('/library#one'), to: url('/library#two'), shallow: false })
		).toBe(false);
		expect(managesMobileScroll({ from: url('/home'), to: url('/app'), shallow: false })).toBe(
			false
		);
	});

	it('focuses only when the destination scene changes', () => {
		expect(
			shouldFocusMobileDestination({
				from: url('/search?q=first'),
				to: url('/search?q=second'),
				shallow: false
			})
		).toBe(false);
		expect(
			shouldFocusMobileDestination({ from: url('/search'), to: url('/library'), shallow: false })
		).toBe(true);
	});
});

describe('detail return navigation', () => {
	it('preserves browse query, filter and pagination in the return link', () => {
		const targets = new Map<string, string>();
		rememberMobileDetailReturn(
			{ from: url('/library?tab=saved&q=night&page=2'), to: url('/playlists/42'), shallow: false },
			targets
		);
		expect(targets.get('/playlists/42')).toBe('/library?tab=saved&q=night&page=2');
	});

	it('returns through nested details without creating a back-link loop', () => {
		const targets = new Map<string, string>();
		for (const [from, to] of [
			['/search?q=ambient', '/artists/1'],
			['/artists/1', '/albums/2'],
			['/albums/2', '/tracks/3'],
			['/tracks/3', '/artists/1'],
			['/tracks/3', '/albums/2'],
			['/albums/2', '/artists/1']
		]) {
			rememberMobileDetailReturn({ from: url(from), to: url(to), shallow: false }, targets);
		}
		expect(targets.get('/tracks/3')).toBe('/albums/2');
		expect(targets.get('/albums/2')).toBe('/artists/1');
		expect(targets.get('/artists/1')).toBe('/search?q=ambient');
	});

	it('updates the parent when opening a detail from another browse scene', () => {
		const targets = new Map([['/albums/2', '/home']]);
		rememberMobileDetailReturn(
			{ from: url('/search?q=ambient'), to: url('/albums/2'), shallow: false },
			targets
		);
		expect(targets.get('/albums/2')).toBe('/search?q=ambient');
	});

	it('keeps localized paths and rejects external, public, shallow and non-detail transitions', () => {
		const targets = new Map<string, string>();
		rememberMobileDetailReturn(
			{ from: url('/de-de/search?q=ambient'), to: url('/de-de/albums/2'), shallow: false },
			targets
		);
		expect(targets.get('/de-de/albums/2')).toBe('/de-de/search?q=ambient');
		for (const from of [null, url('/offline'), new URL('https://other.test/search')]) {
			rememberMobileDetailReturn({ from, to: url('/tracks/3'), shallow: false }, targets);
		}
		rememberMobileDetailReturn(
			{ from: url('/home'), to: url('/tracks/3'), shallow: true },
			targets
		);
		rememberMobileDetailReturn(
			{ from: url('/albums/2'), to: url('/home'), shallow: false },
			targets
		);
		expect(targets.size).toBe(1);
	});
});

describe('Now return navigation', () => {
	it('keeps the actual browse query when opening Now', () => {
		expect(mobilePlayerReturnTarget(url('/search?q=ambient&tab=tracks'), url('/now'))).toBe(
			'/search?q=ambient&tab=tracks'
		);
		expect(isNowRoute('/now/queue')).toBe(true);
	});
	it('does not replace the browse destination while opening queue or accept external/public origins', () => {
		expect(mobilePlayerReturnTarget(url('/now'), url('/now/queue'))).toBeNull();
		expect(mobilePlayerReturnTarget(new URL('https://evil.test/home'), url('/now'))).toBeNull();
		expect(mobilePlayerReturnTarget(url('/sign-in'), url('/now'))).toBeNull();
		expect(mobilePlayerReturnTarget(null, url('/now'))).toBeNull();
	});
});
