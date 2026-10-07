import { describe, expect, it } from 'vitest';
import { EngagedListenTracker } from './engaged-listen';
describe('actual listening time', () => {
	it('counts matching playback beyond thirty seconds, including background gaps', () => {
		const tracker = new EngagedListenTracker();
		tracker.reset(0, 1000);
		expect(tracker.observe(30, true, true, 31000)).toBe(30);
		expect(tracker.observe(31, true, true, 32000)).toBe(31);
	});
	it('does not count seeking, pauses, or another audio source', () => {
		const tracker = new EngagedListenTracker();
		tracker.reset(0, 1000);
		expect(tracker.observe(100, true, true, 2000)).toBe(0);
		expect(tracker.observe(110, false, true, 12000)).toBe(0);
		expect(tracker.observe(120, true, false, 22000)).toBe(0);
		tracker.rebase(120, 50000);
		expect(tracker.observe(121, true, true, 51000)).toBe(1);
	});
});
