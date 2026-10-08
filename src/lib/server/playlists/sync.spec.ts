import { describe, expect, it } from 'vitest';
import { diffPlaylistItems } from './sync';

describe('diffPlaylistItems', () => {
	it('detects added tracks', () => {
		const diff = diffPlaylistItems(['a', 'b', 'c'], ['a', 'b']);
		expect(diff.added).toEqual(['c']);
		expect(diff.removed).toEqual([]);
		expect(diff.reordered).toBe(false);
	});

	it('detects removed tracks', () => {
		const diff = diffPlaylistItems(['a', 'b'], ['a', 'b', 'c']);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual(['c']);
		expect(diff.reordered).toBe(false);
	});

	it('detects both added and removed tracks', () => {
		const diff = diffPlaylistItems(['a', 'c', 'd'], ['a', 'b', 'c']);
		expect(diff.added).toEqual(['d']);
		expect(diff.removed).toEqual(['b']);
		expect(diff.reordered).toBe(false);
	});

	it('detects reordered tracks', () => {
		const diff = diffPlaylistItems(['b', 'a', 'c'], ['a', 'b', 'c']);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
		expect(diff.reordered).toBe(true);
	});

	it('returns empty diff for identical lists', () => {
		const diff = diffPlaylistItems(['a', 'b', 'c'], ['a', 'b', 'c']);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
		expect(diff.reordered).toBe(false);
	});

	it('handles empty local list', () => {
		const diff = diffPlaylistItems([], ['a', 'b']);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual(['a', 'b']);
		expect(diff.reordered).toBe(false);
	});

	it('handles empty remote list', () => {
		const diff = diffPlaylistItems(['a', 'b'], []);
		expect(diff.added).toEqual(['a', 'b']);
		expect(diff.removed).toEqual([]);
		expect(diff.reordered).toBe(false);
	});

	it('handles both lists empty', () => {
		const diff = diffPlaylistItems([], []);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
		expect(diff.reordered).toBe(false);
	});

	it('detects reorder with additions', () => {
		const diff = diffPlaylistItems(['c', 'a', 'b', 'd'], ['a', 'b', 'c']);
		expect(diff.added).toEqual(['d']);
		expect(diff.removed).toEqual([]);
		expect(diff.reordered).toBe(true);
	});
});

it('counts deliberate duplicate occurrences in additions and removals', () => {
	expect(diffPlaylistItems(['a', 'a', 'b'], ['a', 'b'])).toMatchObject({
		added: ['a'],
		removed: []
	});
	expect(diffPlaylistItems(['a', 'b'], ['a', 'a', 'b'])).toMatchObject({
		added: [],
		removed: ['a']
	});
});
