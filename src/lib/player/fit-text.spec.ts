import { describe, expect, it } from 'vitest';
import { MIN_FIT_SCALE, fitScale } from './fit-text';

describe('fitScale', () => {
	it('leaves text that already fits at full size', () => {
		expect(fitScale(300, 240)).toBe(1);
		expect(fitScale(300, 300)).toBe(1);
	});

	it('shrinks an overlong line just enough to fit, rounding down', () => {
		expect(fitScale(300, 400)).toBe(0.75);
		expect(fitScale(300, 301)).toBe(0.99);
	});

	it('stops at the minimum so a very long line ellipsises rather than turning tiny', () => {
		expect(fitScale(300, 2000)).toBe(MIN_FIT_SCALE);
		expect(fitScale(300, 2000, 0.8)).toBe(0.8);
	});

	it('does nothing before the box has been laid out', () => {
		expect(fitScale(0, 400)).toBe(1);
		expect(fitScale(Number.NaN, 400)).toBe(1);
	});
});
