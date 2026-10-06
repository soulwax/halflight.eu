import { describe, expect, it } from 'vitest';
import {
	CLOSE_SWIPE_PX,
	TRACK_SWIPE_PX,
	dampDrag,
	inferTrackStep,
	lockDragAxis,
	resolveArtworkSwipe,
	swipeWouldCommit
} from './gestures';

describe('lockDragAxis', () => {
	it('waits for deliberate travel before committing', () => {
		expect(lockDragAxis(3, -4)).toBeNull();
	});

	it('locks to the dominant axis', () => {
		expect(lockDragAxis(-20, 6)).toBe('x');
		expect(lockDragAxis(5, 18)).toBe('y');
	});
});

describe('dampDrag', () => {
	it('follows small drags closely and never exceeds the limit', () => {
		expect(dampDrag(10, 140)).toBeGreaterThan(9);
		expect(dampDrag(5000, 140)).toBeLessThanOrEqual(140);
		expect(dampDrag(-5000, 140)).toBeGreaterThanOrEqual(-140);
	});

	it('treats invalid input as no movement', () => {
		expect(dampDrag(Number.NaN)).toBe(0);
		expect(dampDrag(0)).toBe(0);
	});
});

describe('resolveArtworkSwipe', () => {
	it('maps a long horizontal drag to next or previous', () => {
		const slow = 900;
		expect(resolveArtworkSwipe({ dx: -TRACK_SWIPE_PX, dy: 4, durationMs: slow }, 'x')).toBe('next');
		expect(resolveArtworkSwipe({ dx: TRACK_SWIPE_PX, dy: -4, durationMs: slow }, 'x')).toBe(
			'previous'
		);
	});

	it('accepts a short fast flick but not a short slow drag', () => {
		expect(resolveArtworkSwipe({ dx: -40, dy: 0, durationMs: 60 }, 'x')).toBe('next');
		expect(resolveArtworkSwipe({ dx: -40, dy: 0, durationMs: 600 }, 'x')).toBeNull();
	});

	it('ignores a tiny jitter even when it is fast', () => {
		expect(resolveArtworkSwipe({ dx: -12, dy: 0, durationMs: 4 }, 'x')).toBeNull();
	});

	it('closes only on a downward vertical swipe', () => {
		expect(resolveArtworkSwipe({ dx: 0, dy: CLOSE_SWIPE_PX, durationMs: 900 }, 'y')).toBe('close');
		expect(resolveArtworkSwipe({ dx: 0, dy: -CLOSE_SWIPE_PX, durationMs: 900 }, 'y')).toBeNull();
		expect(resolveArtworkSwipe({ dx: 0, dy: 60, durationMs: 900 }, 'y')).toBeNull();
	});

	it('springs back when no axis was locked', () => {
		expect(resolveArtworkSwipe({ dx: -200, dy: 0, durationMs: 100 }, null)).toBeNull();
	});
});

describe('swipeWouldCommit', () => {
	it('commits only past the travel threshold on the locked axis', () => {
		expect(swipeWouldCommit(-TRACK_SWIPE_PX, 0, 'x')).toBe(true);
		expect(swipeWouldCommit(TRACK_SWIPE_PX - 1, 0, 'x')).toBe(false);
		expect(swipeWouldCommit(0, CLOSE_SWIPE_PX, 'y')).toBe(true);
		expect(swipeWouldCommit(0, -CLOSE_SWIPE_PX, 'y')).toBe(false);
		expect(swipeWouldCommit(500, 500, null)).toBe(false);
	});
});

describe('inferTrackStep', () => {
	const before = { trackId: 'b', upcomingIds: ['c', 'd'], previousId: 'a' };

	it('recognises a step back to the last history entry', () => {
		expect(inferTrackStep(before, 'a')).toBe('previous');
	});

	it('recognises any queued track as a step forward, including shuffle and queue picks', () => {
		expect(inferTrackStep(before, 'c')).toBe('next');
		expect(inferTrackStep(before, 'd')).toBe('next');
	});

	it('does not invent a direction for unrelated changes', () => {
		expect(inferTrackStep(before, 'z')).toBeNull();
		expect(inferTrackStep(before, 'b')).toBeNull();
		expect(inferTrackStep(before, null)).toBeNull();
		expect(inferTrackStep({ ...before, trackId: null }, 'c')).toBeNull();
	});
});
