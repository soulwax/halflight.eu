import type { Action } from 'svelte/action';

export type LyricCue = { time: number; text: string };

/** Index of the cue active at media time, or -1 before its first timestamp. */
export function activeLyricIndexAt(cues: readonly LyricCue[], time: number): number {
	if (!cues.length || !Number.isFinite(time) || time < cues[0].time) return -1;

	let low = 0;
	let high = cues.length;
	while (low < high) {
		const middle = low + Math.floor((high - low) / 2);
		if (cues[middle].time <= time) low = middle + 1;
		else high = middle;
	}
	return low - 1;
}

/** The text of the cue after `activeIndex`, or '' when there is none. */
export function nextLyricText(cues: readonly LyricCue[], activeIndex: number): string {
	if (!cues.length) return '';
	return cues[Math.max(0, activeIndex + 1)]?.text.trim() ?? '';
}

/** Keeps the active lyric line centred in its scroll container as playback advances. */
export const followActiveLyric: Action<HTMLElement, boolean> = (node, active) => {
	function follow(isActive: boolean | undefined) {
		if (!isActive || typeof node.scrollIntoView !== 'function') return;
		const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		node.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
	}
	follow(active);
	return { update: follow };
};
