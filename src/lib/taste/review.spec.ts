import { describe, expect, it } from 'vitest';
import { findSwapCandidate, reviewSwap, swapProvisionalTrack } from './review';
import type { ProvisionalSet, ProvisionalTrack } from './provisional';

const first: ProvisionalTrack = {
	id: 'first',
	title: 'First',
	artists: [{ id: 'a', name: 'A' }],
	duration: 120,
	reason: { code: 'anchor_artist', artistId: 'a', artistName: 'A' },
	outsideAnchors: false
};
const second: ProvisionalTrack = {
	id: 'second',
	title: 'Second',
	artists: [{ id: 'b', name: 'B' }],
	reason: { code: 'similar_artist', seedArtistId: 'a', seedArtistName: 'A' },
	outsideAnchors: true
};
const set: ProvisionalSet = {
	tracks: [first, second],
	trackCount: 2,
	knownDurationSeconds: 120,
	unknownDurationCount: 1,
	estimatedDurationSeconds: 330,
	discoveryPercentage: 50,
	confidenceLabel: 'good',
	degraded: false,
	generatedAt: '2026-09-14T00:00:00.000Z'
};

function track(id: string, artistId: string): ProvisionalTrack {
	return {
		id,
		title: id,
		artists: [{ id: artistId, name: artistId }],
		duration: 200,
		reason: { code: 'profile_match' },
		outsideAnchors: false
	};
}

/** Mirrors the server: the chosen tracks lead the pool, unchosen candidates follow. */
function reviewSet(tracks: ProvisionalTrack[], extra: ProvisionalTrack[]): ProvisionalSet {
	return { ...set, tracks, trackCount: tracks.length, swapCandidates: [...tracks, ...extra] };
}

describe('provisional set review', () => {
	it('swaps an unused candidate and recomputes only derived summary values', () => {
		const replacement: ProvisionalTrack = {
			...second,
			id: 'third',
			title: 'Third',
			duration: 180,
			outsideAnchors: false
		};
		const result = swapProvisionalTrack(set, 1, replacement);
		expect(result).toMatchObject({
			tracks: [first, replacement],
			knownDurationSeconds: 300,
			unknownDurationCount: 0,
			estimatedDurationSeconds: 300,
			discoveryPercentage: 0
		});
		expect(set.tracks[1]).toBe(second);
	});

	it('refuses a duplicate or invalid replacement', () => {
		expect(swapProvisionalTrack(set, 1, first)).toBeNull();
		expect(swapProvisionalTrack(set, 4, second)).toBeNull();
	});
});

describe('swap candidate selection', () => {
	const chosen = [track('a1', 'a'), track('b1', 'b'), track('c1', 'c')];

	it('rotates through the whole pool instead of toggling back to the swapped-out track', () => {
		let current = reviewSet(chosen, [track('b2', 'b'), track('d1', 'd'), track('e1', 'e')]);
		const offered: string[] = [];

		for (let swap = 0; swap < 4; swap++) {
			const result = reviewSwap(current, 0);
			expect(result).not.toBeNull();
			if (!result) return;
			offered.push(result.replacement.id);
			current = result.set;
		}

		// b2 shares artist b with the next slot, so spacing skips it while other options remain.
		expect(offered).toEqual(['d1', 'e1', 'a1', 'd1']);
	});

	it('keeps neighbouring slots free of the same primary artist while it can', () => {
		const pool = reviewSet(chosen, [track('a2', 'a'), track('c2', 'c'), track('d1', 'd')]);
		expect(findSwapCandidate(pool, 1)?.id).toBe('d1');
	});

	it('yields spacing only when every remaining candidate repeats a neighbour', () => {
		const pool = reviewSet(chosen, [track('b2', 'b')]);
		expect(findSwapCandidate(pool, 0)?.id).toBe('b2');
	});

	it('offers nothing when the pool is exhausted, absent, or the slot does not exist', () => {
		expect(findSwapCandidate(reviewSet(chosen, []), 0)).toBeNull();
		expect(findSwapCandidate({ ...set, swapCandidates: undefined }, 0)).toBeNull();
		expect(findSwapCandidate(reviewSet(chosen, [track('d1', 'd')]), 3)).toBeNull();
		expect(reviewSwap(reviewSet(chosen, []), 1)).toBeNull();
	});
});
