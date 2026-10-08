import { describe, expect, it } from 'vitest';
import { projectPlaybackPosition } from './playback-position';
describe('precise server playback clock', () => {
	it('keeps fractions and advances an active playback sample', () => {
		expect(projectPlaybackPosition(10.125, 1000, true, 2500, 50000, 100)).toBe(11.625);
	});
	it('freezes pauses, buffering, expired leases and samples from the future', () => {
		expect(projectPlaybackPosition(10.125, 1000, false, 2500, 50000)).toBe(10.125);
		expect(projectPlaybackPosition(10.125, 1000, true, 2500, 2000)).toBe(11.125);
		expect(projectPlaybackPosition(10.125, 1000, true, 25000, 2000)).toBe(11.125);
		expect(projectPlaybackPosition(10.125, 5000, true, 2500, 50000)).toBe(10.125);
	});
	it('bounds stale device progress and never passes the end of the song', () => {
		expect(projectPlaybackPosition(10.125, 1000, true, 25000, 50000)).toBe(20.125);
		expect(projectPlaybackPosition(98.5, 1000, true, 5000, 50000, 100)).toBe(100);
		expect(projectPlaybackPosition(NaN, NaN, true, 5000, 50000)).toBe(0);
	});
});
