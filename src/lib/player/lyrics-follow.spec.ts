import { describe, expect, it } from 'vitest';
import { nextLyricText } from './lyrics-follow';

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

	it('treats a not-yet-started song as the first line', () => {
		expect(nextLyricText(cues, -1)).toBe('two');
	});
});
