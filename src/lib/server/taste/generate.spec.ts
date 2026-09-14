import { describe, expect, it } from 'vitest';
import { generateTasteSet } from './generate';
import { emptyTasteProfile } from './profile';
import type { GraphExpansionClient } from './graph';

describe('taste generation orchestrator', () => {
	const mockClient: GraphExpansionClient = {
		async getSimilarArtists(artistId) {
			if (artistId === 'a1') return [{ id: 'sim1', name: 'Similar One' }];
			return [];
		},
		async getArtistTracks(artistId) {
			return [
				{
					id: `track-${artistId}-1`,
					title: `Song from ${artistId}`,
					isrc: `ISRC-${artistId}-1`,
					duration: 200,
					releaseDate: '2019-05-01',
					artists: [{ id: artistId, name: `Artist ${artistId}` }]
				},
				{
					id: `track-${artistId}-2`,
					title: `Song 2 from ${artistId}`,
					isrc: `ISRC-${artistId}-2`,
					duration: 220,
					releaseDate: '2021-08-10',
					artists: [{ id: artistId, name: `Artist ${artistId}` }]
				}
			];
		}
	};

	it('returns a locale-neutral empty set on cold start (0 anchors)', async () => {
		const profile = emptyTasteProfile();
		const result = await generateTasteSet(profile, { client: mockClient });

		expect(result.trackCount).toBe(0);
		expect(result.degraded).toBe(true);
		expect(result.confidenceLabel).toBe('none');
		expect(result.estimatedDurationSeconds).toBe(0);
		expect(result.unknownDurationCount).toBe(0);
		expect(result.swapCandidates).toEqual([]);
	});

	it('generates an honest sequenced set with structured reasons', async () => {
		const profile = emptyTasteProfile();
		profile.artists = { a1: 1 };
		profile.confidence.artists = 0.8;
		profile.confidence.eras = 0.8;

		const result = await generateTasteSet(profile, {
			client: mockClient,
			knobs: { targetCount: 3, familiarity: 70 },
			sleep: () => Promise.resolve()
		});

		expect(result.trackCount).toBe(3);
		expect(result.tracks.length).toBe(3);
		expect(result.tracks[0].reason.code).toBe('anchor_artist');
		expect(result.tracks[0].reason).toHaveProperty('artistId', 'a1');
		expect(result.unknownDurationCount).toBe(0);
		expect(result.degraded).toBe(false);
		// The review pool leads with the chosen tracks, then the unchosen scored candidates.
		expect(result.swapCandidates?.slice(0, 3)).toEqual(result.tracks);
		expect(result.swapCandidates).toHaveLength(4);
		expect(result.swapCandidates?.every((track) => track.outsideAnchors !== undefined)).toBe(true);
	});
});
