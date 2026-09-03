import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './format';

describe('formatDuration', () => {
	it('renders m:ss with a zero-padded seconds field', () => {
		expect(formatDuration(200)).toBe('3:20');
		expect(formatDuration(5)).toBe('0:05');
	});

	it('rolls over to h:mm:ss past an hour', () => {
		expect(formatDuration(3661)).toBe('1:01:01');
		expect(formatDuration(75 * 60)).toBe('1:15:00');
	});

	it('floors fractional seconds', () => {
		expect(formatDuration(12.9)).toBe('0:12');
	});

	it('returns an empty string for missing, zero, or invalid input', () => {
		expect(formatDuration(undefined)).toBe('');
		expect(formatDuration(null)).toBe('');
		expect(formatDuration(0)).toBe('');
		expect(formatDuration(-1)).toBe('');
		expect(formatDuration(NaN)).toBe('');
	});
});

describe('formatClock', () => {
	it('always renders, falling back to 0:00', () => {
		expect(formatClock(undefined)).toBe('0:00');
		expect(formatClock(NaN)).toBe('0:00');
		expect(formatClock(-5)).toBe('0:00');
	});

	it('formats a live position', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(94.4)).toBe('1:34');
	});
});
