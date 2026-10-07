import type { Action } from 'svelte/action';

/** Smallest share of its base size a fitted line may shrink to before it ellipsises. */
export const MIN_FIT_SCALE = 0.62;

/**
 * Scale that makes text of `naturalWidth` fit `availableWidth`, never growing
 * past 1 and never shrinking below `min` (the line ellipsises past that).
 */
export function fitScale(
	availableWidth: number,
	naturalWidth: number,
	min = MIN_FIT_SCALE
): number {
	if (!(availableWidth > 0) || !(naturalWidth > availableWidth)) return 1;
	// Round down to a hundredth so rounding never leaves a pixel of overflow.
	return Math.max(min, Math.floor((availableWidth / naturalWidth) * 100) / 100);
}

/**
 * Keeps a single line of text on one line by shrinking its font until it fits
 * its box. The box's height must not depend on the font size (give it a fixed
 * `height`/`line-height` in rem), so a long lyric never resizes the layout.
 * Pass the text as the parameter so the line refits when it changes.
 */
export const fitText: Action<HTMLElement, string | undefined> = (node) => {
	let frame = 0;
	function fit() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			node.style.removeProperty('font-size');
			const base = Number.parseFloat(getComputedStyle(node).fontSize);
			const scale = fitScale(node.clientWidth, node.scrollWidth);
			if (scale < 1 && base > 0) node.style.fontSize = `${base * scale}px`;
		});
	}
	fit();
	const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
	observer?.observe(node);
	return {
		update: fit,
		destroy() {
			cancelAnimationFrame(frame);
			observer?.disconnect();
		}
	};
};
