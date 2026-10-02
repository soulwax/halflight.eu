import { describe, expect, it } from 'vitest';
import {
	managesMobileScroll,
	mobileScrollKey,
	shouldFocusMobileDestination,
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
