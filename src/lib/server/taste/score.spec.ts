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

	// The artist-repeat penalty is applied by `sequence.ts` during selection, not
	// here — see the note on `scoreCandidate`'s combined-score step. Covered by
	// sequence.spec.ts's "applies repeat penalties while selecting and is stable
	// regardless of input order".

	it('rewards tracks inside a requested era window and penalizes those outside', () => {
		const inWindow: FilteredCandidate = { ...discoveryTrack, id: 't-2016', year: 2016 };
		const outOfWindow: FilteredCandidate = { ...discoveryTrack, id: 't-1990', year: 1990 };
		const era = { center: 2016, spread: 8 };

		const scoredIn = scoreCandidate(inWindow, profile, { familiarity: 50, era });
		const scoredOut = scoreCandidate(outOfWindow, profile, { familiarity: 50, era });
		const scoredNoEra = scoreCandidate(inWindow, profile, { familiarity: 50 });

		expect(scoredIn.fit).toBe(1);
		expect(scoredOut.fit).toBe(0);
		expect(scoredIn.score).toBeGreaterThan(scoredNoEra.score);
		expect(scoredOut.score).toBeLessThan(scoredNoEra.score);
	});

	it('stays neutral on era fit when the year is unknown or no era is requested', () => {
		const undated: FilteredCandidate = { ...discoveryTrack, id: 't-undated', year: undefined };

		const withEra = scoreCandidate(undated, profile, {
			familiarity: 50,
			era: { center: 2016, spread: 8 }
		});
		const withoutEra = scoreCandidate(undated, profile, { familiarity: 50 });

		expect(withEra.fit).toBe(0.5);
		expect(withEra.score).toBe(withoutEra.score);
	});
});
