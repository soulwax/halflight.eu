import { describe, expect, it } from 'vitest';
import { expandTasteGraph, type GraphExpansionClient } from './graph';

describe('taste graph expansion', () => {
	const mockClient: GraphExpansionClient = {
		async getSimilarArtists(artistId) {
			if (artistId === 'a1') {
				return [
					{ id: 'sim-1', name: 'Similar One' },
					{ id: 'sim-2', name: 'Similar Two' }
				];
			}
			return [];
		},
		async getArtistTracks(artistId) {
			return [
				{
					id: `track-${artistId}-1`,
					title: `Track 1 by ${artistId}`,
					isrc: `ISRC-${artistId}-1`,
					duration: 240,
					artists: [{ id: artistId, name: `Artist ${artistId}` }]
				}
			];
		}
	};

	it('expands anchor tracks and discovers neighbourhood candidates', async () => {
		const anchors = [{ id: 'a1', name: 'Artist 1', weight: 1 }];
		const res = await expandTasteGraph(anchors, mockClient, { maxRequests: 10, fanoutLimit: 5 });

		expect(res.requestsSpent).toBe(4); // a1 tracks (1) + a1 similar (1) + sim-1 tracks (1) + sim-2 tracks (1)
		expect(res.degraded).toBe(false);
		expect(res.candidates.length).toBe(3);

		const anchorTrack = res.candidates.find((c) => c.id === 'track-a1-1');
		expect(anchorTrack?.provenance.edge).toBe('anchor');

		const simTrack = res.candidates.find((c) => c.id === 'track-sim-1-1');
		expect(simTrack?.provenance.edge).toBe('similar_artist');
	});

	it('enforces request budget and flags degraded when limit is reached', async () => {
		const anchors = [
			{ id: 'a1', name: 'Artist 1', weight: 1 },
			{ id: 'a2', name: 'Artist 2', weight: 0.8 }
		];
		// With a tight budget of 2 requests:
		const res = await expandTasteGraph(anchors, mockClient, { maxRequests: 2, fanoutLimit: 5 });

		expect(res.requestsSpent).toBe(2);
		expect(res.degraded).toBe(true);
		expect(res.candidates.length).toBe(2);
	});

	it('handles client errors gracefully without throwing', async () => {
		const failingClient: GraphExpansionClient = {
			async getSimilarArtists() {
				throw new Error('Upstream 429');
			},
			async getArtistTracks() {
				throw new Error('Upstream 500');
			}
		};

		const anchors = [{ id: 'a1', name: 'Artist 1', weight: 1 }];
		const res = await expandTasteGraph(anchors, failingClient, { maxRequests: 5, fanoutLimit: 5 });

		expect(res.candidates.length).toBe(0);
		expect(res.degraded).toBe(true);
	});
});
