import { describe, expect, it } from 'vitest';
import { generateTasteSet } from './generate';
import { emptyTasteProfile } from './profile';
import { m } from '#lib/paraglide/messages.js';
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

	it('returns a graceful degradation message on cold start (0 anchors)', async () => {
		const profile = emptyTasteProfile();
		const result = await generateTasteSet(profile, { client: mockClient });

		expect(result.trackCount).toBe(0);
		expect(result.degraded).toBe(true);
		expect(result.confidenceLabel).toBe('none');
		expect(result.summary).toBe(m.taste_set_cold_start());
	});

	it('generates an honest sequenced set with provenance chips', async () => {
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
		expect(result.tracks[0].provenance).toContain('Artist a1');
		expect(result.summary).toContain('3 tracks');
		expect(result.degraded).toBe(false);
	});
});
