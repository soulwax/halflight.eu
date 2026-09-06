import { describe, expect, it } from 'vitest';
import { managesMobileScroll, mobileScrollKey, shouldFocusMobileDestination } from './navigation';

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
