import { describe, expect, it } from 'vitest';
import { scoreCandidate } from './score';
import { emptyTasteProfile } from './profile';
import type { FilteredCandidate } from './candidates';

describe('candidate scoring', () => {
	const profile = emptyTasteProfile();
	profile.artists = { anchor1: 1, anchor2: 0.8 };
	profile.eras = { '2010': 1, '2000': 0.5 };

	const lovedTrack: FilteredCandidate = {
		id: 't-anchor',
		title: 'Anchor Track',
		primaryArtistId: 'anchor1',
		primaryArtistName: 'Anchor 1',
		decade: 2010,
		artists: [{ id: 'anchor1', name: 'Anchor 1' }],
		provenance: { edge: 'anchor', seedArtistId: 'anchor1' }
	};

	const discoveryTrack: FilteredCandidate = {
		id: 't-discovery',
		title: 'Discovery Track',
		primaryArtistId: 'new-artist',
		primaryArtistName: 'New Artist',
		decade: 2010,
		artists: [{ id: 'new-artist', name: 'New Artist' }],
		provenance: { edge: 'similar_artist', seedArtistId: 'anchor1' }
	};

	it('favours loved anchors when familiarity is high', () => {
		const scoredLoved = scoreCandidate(lovedTrack, profile, { familiarity: 90 });
		const scoredDiscovery = scoreCandidate(discoveryTrack, profile, { familiarity: 90 });

		expect(scoredLoved.score).toBeGreaterThan(scoredDiscovery.score);
		expect(scoredLoved.affinity).toBe(1);
	});

	it('favours discovery/novelty when familiarity is low', () => {
		const scoredLoved = scoreCandidate(lovedTrack, profile, { familiarity: 10 });
		const scoredDiscovery = scoreCandidate(discoveryTrack, profile, { familiarity: 10 });

		expect(scoredDiscovery.score).toBeGreaterThan(scoredLoved.score);
		expect(scoredDiscovery.novelty).toBeGreaterThan(0.5);
	});

	it('penalizes artist over-representation', () => {
		const normal = scoreCandidate(lovedTrack, profile, { familiarity: 50 });
		const penalized = scoreCandidate(lovedTrack, profile, {
			familiarity: 50,
			artistCounts: new Map([['anchor1', 3]])
		});

		expect(penalized.score).toBeLessThan(normal.score);
	});
});
