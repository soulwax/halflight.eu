import { describe, expect, it, vi } from 'vitest';
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

	it('stops at the wall-clock deadline and returns a partial, degraded result', async () => {
		let elapsed = 0;
		const slowClient: GraphExpansionClient = {
			async getSimilarArtists() {
				return [];
			},
			async getArtistTracks(artistId) {
				elapsed += 4000; // each upstream call "takes" 4 seconds
				return [
					{ id: `track-${artistId}`, title: `T ${artistId}`, artists: [{ id: artistId, name: '' }] }
				];
			}
		};

		const anchors = [
			{ id: 'a1', name: 'Artist 1', weight: 1 },
			{ id: 'a2', name: 'Artist 2', weight: 0.9 },
			{ id: 'a3', name: 'Artist 3', weight: 0.8 }
		];

		const res = await expandTasteGraph(
			anchors,
			slowClient,
			{ maxRequests: 20, fanoutLimit: 5, deadlineMs: 7000 },
			() => elapsed
		);

		// First two anchor-track calls land under the ceiling (elapsed 4s, then
		// 8s); the third crosses it, so expansion stops with what it has.
		expect(res.requestsSpent).toBe(2);
		expect(res.candidates.length).toBe(2);
		expect(res.degraded).toBe(true);
	});

	it('skips the time check when no deadline is set', async () => {
		let elapsed = 0;
		const slowClient: GraphExpansionClient = {
			async getSimilarArtists() {
				return [];
			},
			async getArtistTracks(artistId) {
				elapsed += 60_000;
				return [
					{ id: `track-${artistId}`, title: `T ${artistId}`, artists: [{ id: artistId, name: '' }] }
				];
			}
		};

		const anchors = [
			{ id: 'a1', name: 'Artist 1', weight: 1 },
			{ id: 'a2', name: 'Artist 2', weight: 0.9 }
		];

		const res = await expandTasteGraph(
			anchors,
			slowClient,
			{ maxRequests: 20, fanoutLimit: 5 },
			() => elapsed
		);

		// 2 anchor-track calls + 2 similar-artist lookups; no time check applied.
		expect(res.requestsSpent).toBe(4);
		expect(res.degraded).toBe(false);
	});

	it('paces upstream calls, skipping the delay before the first one', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const anchors = [{ id: 'a1', name: 'Artist 1', weight: 1 }];

		const res = await expandTasteGraph(
			anchors,
			mockClient,
			{ maxRequests: 10, fanoutLimit: 5, pacingMs: 100 },
			() => 0,
			sleep
		);

		// 4 upstream calls (a1 tracks, a1 similar, sim-1 tracks, sim-2 tracks);
		// the first is not paced, so sleep fires exactly 3 times at 100ms.
		expect(res.requestsSpent).toBe(4);
		expect(sleep).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledWith(100);
	});

	it('does not pace when pacingMs is unset', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		await expandTasteGraph(
			[{ id: 'a1', name: 'Artist 1', weight: 1 }],
			mockClient,
			{ maxRequests: 10, fanoutLimit: 5 },
			() => 0,
			sleep
		);
		expect(sleep).not.toHaveBeenCalled();
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
