import { describe, expect, it } from 'vitest';
import { ACTION_SIZE, BAR_PADDING, layoutBar, placeBar, VIEWPORT_MARGIN } from './placement';

const viewport = { width: 1280, height: 800 };

describe('context bar layout', () => {
	it('is a single row of 32px symbols when it fits', () => {
		expect(layoutBar(8, viewport)).toEqual({
			columns: 8,
			rows: 1,
			width: 8 * ACTION_SIZE + 2 * BAR_PADDING,
			height: ACTION_SIZE + 2 * BAR_PADDING
		});
	});

	it('wraps into balanced rows on a narrow viewport', () => {
		// 320 - 16 - 8 = 296px usable → 9 columns; 10 actions → 2 rows of 5.
		expect(layoutBar(10, { width: 320, height: 600 })).toMatchObject({ columns: 5, rows: 2 });
	});

	it('never collapses below one column', () => {
		expect(layoutBar(3, { width: 20, height: 600 })).toMatchObject({ columns: 1, rows: 3 });
	});
});

describe('context bar placement', () => {
	const size = { width: 200, height: 40 };

	it('opens down and to the right of the pointer when there is room', () => {
		expect(placeBar({ x: 100, y: 100 }, size, viewport)).toEqual({
			left: 100,
			top: 100,
			flippedX: false,
			flippedY: false
		});
	});

	it('reverses to grow left near the right edge', () => {
		expect(placeBar({ x: 1200, y: 100 }, size, viewport)).toMatchObject({
			left: 1000,
			flippedX: true,
			flippedY: false
		});
	});

	it('reverses to grow up near the bottom edge', () => {
		expect(placeBar({ x: 100, y: 790 }, size, viewport)).toMatchObject({
			top: 750,
			flippedX: false,
			flippedY: true
		});
	});

	it('scaffolds up and left in the bottom-right corner', () => {
		expect(placeBar({ x: 1270, y: 790 }, size, viewport)).toEqual({
			left: 1070,
			top: 750,
			flippedX: true,
			flippedY: true
		});
	});

	it('stays inside the margins when neither side has room', () => {
		const placed = placeBar(
			{ x: 150, y: 20 },
			{ width: 300, height: 40 },
			{ width: 320, height: 800 }
		);
		expect(placed.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
		expect(placed.left + 300).toBeLessThanOrEqual(320 - VIEWPORT_MARGIN);
	});

	it('keeps a bar opened at the very edge off the margin', () => {
		expect(placeBar({ x: 0, y: 0 }, size, viewport)).toMatchObject({
			left: VIEWPORT_MARGIN,
			top: VIEWPORT_MARGIN
		});
	});
});
