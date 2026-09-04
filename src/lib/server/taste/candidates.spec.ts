import { describe, expect, it } from 'vitest';
import { filterCandidates } from './candidates';
import { emptyTasteProfile } from './profile';
import type { GraphCandidateTrack } from './graph';

describe('candidates filtering', () => {
	const dummyTracks: GraphCandidateTrack[] = [
		{
			id: 't1',
			title: 'Track 1',
			isrc: 'ISRC1',
			releaseDate: '2015-06-01',
			artists: [{ id: 'a1', name: 'Artist 1' }],
			provenance: { edge: 'anchor', seedArtistId: 'a1' }
		},
		{
			id: 't2',
			title: 'Track 1 (Remastered)',
			isrc: 'ISRC1', // Duplicate recording via ISRC
			releaseDate: '2020-01-01',
			artists: [{ id: 'a1', name: 'Artist 1' }],
			provenance: { edge: 'anchor', seedArtistId: 'a1' }
		},
		{
			id: 't3',
			title: 'Track 3',
			isrc: 'ISRC3',
			releaseDate: '1985-05-10',
			artists: [{ id: 'a2', name: 'Artist 2' }],
			provenance: { edge: 'similar_artist', seedArtistId: 'a1' }
		},
		{
			id: 't4',
			title: 'Track 4',
			isrc: 'ISRC4',
			releaseDate: '2022-03-15',
			artists: [{ id: 'a3-excluded', name: 'Artist 3' }],
			provenance: { edge: 'similar_artist', seedArtistId: 'a1' }
		}
	];

	it('deduplicates by ISRC and track ID', () => {
		const profile = emptyTasteProfile();
		const result = filterCandidates(dummyTracks, profile);

		expect(result.map((r) => r.id)).toEqual(['t1', 't3', 't4']);
	});

	it('drops excluded artists and eras', () => {
		const profile = emptyTasteProfile();
		profile.exclusions.artists = ['a3-excluded'];
		profile.exclusions.eras = [1980]; // Drops t3 (1985 -> 1980s)

		const result = filterCandidates(dummyTracks, profile);
		expect(result.map((r) => r.id)).toEqual(['t1']);
	});

	it('drops cooldown track IDs', () => {
		const profile = emptyTasteProfile();
		const cooldown = new Set(['t1']);

		const result = filterCandidates(dummyTracks, profile, cooldown);
		expect(result.map((r) => r.id)).toEqual(['t3', 't4']);
	});
});
