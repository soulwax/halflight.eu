/** Each action is a square symbol button. */
export const ACTION_SIZE = 32;
/** Inner padding of the bar and the gap between rows. */
export const BAR_PADDING = 4;
/** Keep the bar this far from every viewport edge. */
export const VIEWPORT_MARGIN = 8;

export interface Point {
	x: number;
	y: number;
}
export interface Size {
	width: number;
	height: number;
}

export interface BarLayout extends Size {
	columns: number;
	rows: number;
}

/**
 * A single row of symbols when it fits; otherwise wrap into the fewest rows the
 * viewport allows, keeping rows balanced so the last one is not a lone stub.
 */
export function layoutBar(actionCount: number, viewport: Size): BarLayout {
	const count = Math.max(1, actionCount);
	const usable = viewport.width - 2 * VIEWPORT_MARGIN - 2 * BAR_PADDING;
	const maxColumns = Math.max(1, Math.floor(usable / ACTION_SIZE));
	const rows = Math.ceil(count / maxColumns);
	const columns = Math.ceil(count / rows);
	return {
		columns,
		rows,
		width: columns * ACTION_SIZE + 2 * BAR_PADDING,
		height: rows * ACTION_SIZE + (rows - 1) * BAR_PADDING + 2 * BAR_PADDING
	};
}

export interface Placement {
	left: number;
	top: number;
	/** The bar grows leftward from the pointer. */
	flippedX: boolean;
	/** The bar grows upward from the pointer. */
	flippedY: boolean;
}

function axis(start: number, length: number, extent: number): { at: number; flipped: boolean } {
	const max = extent - VIEWPORT_MARGIN - length;
	if (start <= max) return { at: Math.max(VIEWPORT_MARGIN, start), flipped: false };
	// Not enough room after the pointer: pivot so the bar grows back from it.
	const reversed = start - length;
	if (reversed >= VIEWPORT_MARGIN) return { at: reversed, flipped: true };
	// Room on neither side: pin to whichever edge keeps the most of it visible.
	return { at: Math.max(VIEWPORT_MARGIN, Math.min(max, reversed)), flipped: true };
}

/** Open at the pointer, reversing the pivot per axis when the viewport runs out. */
export function placeBar(anchor: Point, size: Size, viewport: Size): Placement {
	const x = axis(anchor.x, size.width, viewport.width);
	const y = axis(anchor.y, size.height, viewport.height);
	return { left: x.at, top: y.at, flippedX: x.flipped, flippedY: y.flipped };
}
