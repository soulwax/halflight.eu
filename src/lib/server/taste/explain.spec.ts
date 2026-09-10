import { describe, expect, it } from 'vitest';
import { explainTrack, explainSet } from './explain';
import { emptyTasteProfile } from './profile';
import { m } from '#lib/paraglide/messages.js';
import type { ScoredCandidate } from './score';

describe('taste explainability', () => {
	const profile = emptyTasteProfile();
	profile.artists = { anchor1: 1 };
	profile.overrides.artists = { pinned1: 'pinned' };

	const anchorTrack: ScoredCandidate = {
		id: 't1',
		title: 'Song A',
		primaryArtistId: 'anchor1',
		primaryArtistName: 'Bonobo',
		releaseDate: '2017-01-13',
		duration: 250,
		affinity: 1,
		novelty: 0,
		fit: 0.5,
		score: 1,
		artists: [{ id: 'anchor1', name: 'Bonobo' }],
		provenance: { edge: 'anchor', seedArtistId: 'anchor1' }
	};

	const pinnedTrack: ScoredCandidate = {
		id: 't2',
		title: 'Song B',
		primaryArtistId: 'pinned1',
		primaryArtistName: 'Tycho',
		releaseDate: '2016-09-01',
		duration: 200,
		affinity: 1,
		novelty: 0,
		fit: 0.5,
		score: 1,
		artists: [{ id: 'pinned1', name: 'Tycho' }],
		provenance: { edge: 'anchor', seedArtistId: 'pinned1' }
	};

	const discoveryTrack: ScoredCandidate = {
		id: 't3',
		title: 'Song C',
		primaryArtistId: 'artist3',
		primaryArtistName: 'Emancipator',
		releaseDate: '2020-04-10',
		duration: 210,
		affinity: 0.2,
		novelty: 0.8,
		fit: 0.5,
		score: 0.7,
		artists: [{ id: 'artist3', name: 'Emancipator' }],
		provenance: { edge: 'similar_artist', seedArtistId: 'anchor1', seedArtistName: 'Bonobo' }
	};

	it('explains anchor tracks accurately with release date', () => {
		const explanation = explainTrack(anchorTrack, profile);
		expect(explanation).toBe(`${m.taste_provenance_anchor({ artist: 'Bonobo' })} · 2017`);
	});

	it('explains pinned tracks accurately', () => {
		const explanation = explainTrack(pinnedTrack, profile);
		expect(explanation).toBe(`${m.taste_provenance_pinned({ artist: 'Tycho' })} · 2016`);
	});

	it('explains similar artist discovery tracks with seed artist attribution', () => {
		const explanation = explainTrack(discoveryTrack, profile);
		expect(explanation).toBe(`${m.taste_provenance_similar({ seed: 'Bonobo' })} · 2020`);
	});

	it('drops the year suffix when the track has no release date', () => {
		const undated: ScoredCandidate = { ...anchorTrack, releaseDate: undefined };
		expect(explainTrack(undated, profile)).toBe(m.taste_provenance_anchor({ artist: 'Bonobo' }));
	});

	it('synthesizes a transparent set explanation with duration and discovery share', () => {
		const setExpl = explainSet([anchorTrack, discoveryTrack], profile, false);

		expect(setExpl.trackCount).toBe(2);
		expect(setExpl.discoveryPercentage).toBe(50); // 1 out of 2 is discovery
		expect(setExpl.summary).toContain('2 tracks');
		expect(setExpl.summary).toContain('50% new to you');
	});

	it('emits a stable confidence token, not a display string', () => {
		const thin = explainSet([anchorTrack], profile, false);
		expect(thin.confidenceLabel).toBe('initial'); // empty profile → low confidence

		const confident = emptyTasteProfile();
		confident.confidence.artists = 0.8;
		confident.confidence.eras = 0.8;
		expect(explainSet([anchorTrack], confident, false).confidenceLabel).toBe('high');

		expect(explainSet([anchorTrack], confident, true).confidenceLabel).toBe('initial'); // degraded
	});
});
