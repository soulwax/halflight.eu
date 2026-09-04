import { describe, expect, it } from 'vitest';
import { sequenceCandidates } from './sequence';
import type { ScoredCandidate } from './score';

describe('set sequencing', () => {
	const candidates: ScoredCandidate[] = [
		{
			id: 't1',
			title: 'T1',
			primaryArtistId: 'a1',
			primaryArtistName: 'Artist 1',
			affinity: 0.9,
			novelty: 0.1,
			score: 0.85,
			artists: [{ id: 'a1', name: 'Artist 1' }],
			provenance: { edge: 'anchor', seedArtistId: 'a1' }
		},
		{
			id: 't2',
			title: 'T2',
			primaryArtistId: 'a1',
			primaryArtistName: 'Artist 1',
			affinity: 0.88,
			novelty: 0.1,
			score: 0.83,
			artists: [{ id: 'a1', name: 'Artist 1' }],
			provenance: { edge: 'anchor', seedArtistId: 'a1' }
		},
		{
			id: 't3',
			title: 'T3',
			primaryArtistId: 'a2',
			primaryArtistName: 'Artist 2',
			affinity: 0.7,
			novelty: 0.5,
			score: 0.8,
			artists: [{ id: 'a2', name: 'Artist 2' }],
			provenance: { edge: 'similar_artist', seedArtistId: 'a1' }
		},
		{
			id: 't4',
			title: 'T4',
			primaryArtistId: 'a3',
			primaryArtistName: 'Artist 3',
			affinity: 0.6,
			novelty: 0.6,
			score: 0.78,
			artists: [{ id: 'a3', name: 'Artist 3' }],
			provenance: { edge: 'similar_artist', seedArtistId: 'a1' }
		}
	];

	it('selects opener with highest affinity and spaces artists', () => {
		const sequenced = sequenceCandidates(candidates, { targetCount: 4 });

		expect(sequenced.length).toBe(4);
		expect(sequenced[0].id).toBe('t1'); // high affinity opener

		// Verify no adjacent tracks have the same artist if alternative exists
		for (let i = 0; i < sequenced.length - 1; i++) {
			expect(sequenced[i].primaryArtistId).not.toBe(sequenced[i + 1].primaryArtistId);
		}
	});

	it('respects target count', () => {
		const sequenced = sequenceCandidates(candidates, { targetCount: 2 });
		expect(sequenced.length).toBe(2);
	});
});
