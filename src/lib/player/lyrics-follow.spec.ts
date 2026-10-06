import { describe, expect, it } from 'vitest';
import { activeLyricIndexAt, nextLyricText } from './lyrics-follow';

const cues = [
	{ time: 0, text: 'one' },
	{ time: 5, text: ' two ' },
	{ time: 9, text: 'three' }
];

describe('nextLyricText', () => {
	it('returns the trimmed following line', () => {
		expect(nextLyricText(cues, 0)).toBe('two');
	});

	it('is empty on the last line and without cues', () => {
		expect(nextLyricText(cues, 2)).toBe('');
		expect(nextLyricText([], 0)).toBe('');
	});

	it('previews the first line before its timestamp', () => {
		expect(nextLyricText(cues, -1)).toBe('one');
	});
});

describe('activeLyricIndexAt', () => {
	it('changes at the exact cue timestamp and follows rewinds', () => {
		expect(activeLyricIndexAt(cues, 4.999)).toBe(0);
		expect(activeLyricIndexAt(cues, 5)).toBe(1);
		expect(activeLyricIndexAt(cues, 8.999)).toBe(1);
		expect(activeLyricIndexAt(cues, 9)).toBe(2);
		expect(activeLyricIndexAt(cues, 6)).toBe(1);
	});

	it('handles invalid media time and empty cues without selecting a line', () => {
		expect(activeLyricIndexAt([], 0)).toBe(-1);
		expect(activeLyricIndexAt(cues, Number.NaN)).toBe(-1);
		expect(activeLyricIndexAt(cues, -1)).toBe(-1);
	});
});
