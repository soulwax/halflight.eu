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

	it('carries the release year and decade through for era scoring', () => {
		const profile = emptyTasteProfile();
		const result = filterCandidates(dummyTracks, profile);

		expect(result.find((r) => r.id === 't1')).toMatchObject({ year: 2015, decade: 2010 });
		expect(result.find((r) => r.id === 't3')).toMatchObject({ year: 1985, decade: 1980 });
	});

	it('drops excluded artists and eras', () => {
		const profile = emptyTasteProfile();
		profile.exclusions.artists = ['a3-excluded'];
		profile.exclusions.eras = [1980]; // Drops t3 (1985 -> 1980s)

		const result = filterCandidates(dummyTracks, profile);
		expect(result.map((r) => r.id)).toEqual(['t1']);
	});

	it('checks every credited artist and keeps an eligible duplicate variant', () => {
		const profile = emptyTasteProfile();
		profile.exclusions.artists = ['excluded-feature'];
		const variants: GraphCandidateTrack[] = [
			{
				id: 'ineligible-variant',
				title: 'Same recording',
				isrc: 'ISRC-ELIGIBLE-VARIANT',
				artists: [
					{ id: 'anchor', name: 'Anchor Artist' },
					{ id: 'excluded-feature', name: 'Excluded Feature' }
				],
				provenance: { edge: 'anchor', seedArtistId: 'anchor' }
			},
			{
				id: 'eligible-variant',
				title: 'Same recording (solo)',
				isrc: 'ISRC-ELIGIBLE-VARIANT',
				artists: [{ id: 'anchor', name: 'Anchor Artist' }],
				provenance: { edge: 'anchor', seedArtistId: 'anchor' }
			}
		];

		const result = filterCandidates(variants, profile);

		expect(result.map((track) => track.id)).toEqual(['eligible-variant']);
	});

	it('drops cooldown track IDs without suppressing an eligible recording variant', () => {
		const profile = emptyTasteProfile();
		const cooldown = new Set(['t1']);

		const result = filterCandidates(dummyTracks, profile, cooldown);
		expect(result.map((r) => r.id)).toEqual(['t2', 't3', 't4']);
	});

	it('drops tracks under the minimum length but keeps unknown-duration ones', () => {
		const profile = emptyTasteProfile();
		const lengths: GraphCandidateTrack[] = [
			{
				id: 'skit',
				title: 'Skit',
				isrc: 'ISRC-SKIT',
				duration: 40,
				artists: [{ id: 'a', name: 'A' }],
				provenance: { edge: 'anchor', seedArtistId: 'a' }
			},
			{
				id: 'song',
				title: 'Song',
				isrc: 'ISRC-SONG',
				duration: 200,
				artists: [{ id: 'a', name: 'A' }],
				provenance: { edge: 'anchor', seedArtistId: 'a' }
			},
			{
				id: 'undated',
				title: 'Undated',
				isrc: 'ISRC-UNDATED',
				artists: [{ id: 'a', name: 'A' }],
				provenance: { edge: 'anchor', seedArtistId: 'a' }
			}
		];

		const result = filterCandidates(lengths, profile, new Set(), { minDurationSeconds: 90 });
		expect(result.map((r) => r.id)).toEqual(['song', 'undated']);

		// No floor requested → every length passes.
		expect(filterCandidates(lengths, profile).map((r) => r.id)).toEqual([
			'skit',
			'song',
			'undated'
		]);
	});
});
