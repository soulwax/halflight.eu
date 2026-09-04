import { describe, expect, it } from 'vitest';
import { diffPlaylistItems, rankReplacementTracks, sanitiseImportedTracks } from './sync';

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

describe('rankReplacementTracks', () => {
	it('prefers an exact recording match over a merely popular similar track', () => {
		const source = {
			kind: 'track' as const,
			id: 'source',
			title: 'The Song',
			artists: [{ id: 'artist-1', name: 'Artist One' }],
			album: { id: 'album-1', title: 'The Album' },
			duration: 240
		};

		const ranked = rankReplacementTracks(source, [
			{
				kind: 'track',
				id: 'similar',
				title: 'A Different Song',
				artists: [{ id: 'artist-2', name: 'Other Artist' }],
				popularity: 100
			},
			{
				kind: 'track',
				id: 'equivalent',
				title: 'The Song',
				artists: [{ id: 'artist-1', name: 'Artist One' }],
				album: { id: 'album-1', title: 'The Album' },
				duration: 241
			}
		]);

		expect(ranked.map((track) => track.id)).toEqual(['equivalent', 'similar']);
	});
});

describe('sanitiseImportedTracks', () => {
	it('replaces a known-unplayable import with a verified TIDAL alternative', async () => {
		const unavailable = {
			kind: 'track' as const,
			id: 'unavailable',
			title: 'Unavailable Song',
			artists: [{ id: 'artist-1', name: 'Artist One' }]
		};
		const replacement = {
			kind: 'track' as const,
			id: 'replacement',
			title: 'Available Song',
			artists: [{ id: 'artist-1', name: 'Artist One' }]
		};

		const result = await sanitiseImportedTracks([unavailable], {}, true, {
			checkStreamability: async (track) =>
				track.id === unavailable.id ? 'not_playable' : 'playable',
			findReplacementCandidates: async () => [replacement]
		});

		expect(result).toMatchObject({
			items: [
				{
					id: 'replacement',
					provenance: 'Replaced unavailable TIDAL track unavailable'
				}
			],
			skipped: 0,
			replaced: 1
		});
	});

	it('leaves a track intact when streaming cannot be verified', async () => {
		const source = {
			kind: 'track' as const,
			id: 'source',
			title: 'Keep me',
			artists: []
		};

		const result = await sanitiseImportedTracks([source], {}, true, {
			checkStreamability: async () => 'unverified'
		});

		expect(result).toEqual({ items: [source], skipped: 0, replaced: 0 });
	});
});
