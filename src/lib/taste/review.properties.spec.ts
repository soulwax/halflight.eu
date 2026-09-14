import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	UNKNOWN_DURATION_ESTIMATE_SECONDS,
	type ProvisionalSet,
	type ProvisionalTrack
} from './provisional';
import { reviewSwap } from './review';

const poolTrack = fc
	.record({
		id: fc.uuid(),
		artistId: fc.constantFrom('a', 'b', 'c'),
		duration: fc.option(fc.integer({ min: 1, max: 900 }), { nil: undefined }),
		outsideAnchors: fc.boolean()
	})
	.map(({ id, artistId, duration, outsideAnchors }): ProvisionalTrack => ({
		id,
		title: `Track ${id}`,
		artists: [{ id: artistId, name: `Artist ${artistId}` }],
		...(duration === undefined ? {} : { duration }),
		reason: { code: 'profile_match' },
		outsideAnchors
	}));

const scenario = fc
	.uniqueArray(poolTrack, { selector: (track) => track.id, minLength: 1, maxLength: 24 })
	.chain((pool) =>
		fc.record({
			pool: fc.constant(pool),
			size: fc.integer({ min: 1, max: pool.length }),
			swaps: fc.array(fc.nat({ max: 60 }), { maxLength: 25 })
		})
	);

function artistOf(track: ProvisionalTrack | undefined): string | undefined {
	return track?.artists[0]?.id;
}

describe('provisional set review invariants', () => {
	it('keeps every swapped set unique, pool-bound, honestly summarised, and spaced where possible', () => {
		fc.assert(
			fc.property(scenario, ({ pool, size, swaps }) => {
				const tracks = pool.slice(0, size);
				let set: ProvisionalSet = {
					tracks,
					trackCount: size,
					knownDurationSeconds: 0,
					unknownDurationCount: 0,
					estimatedDurationSeconds: 0,
					discoveryPercentage: 0,
					confidenceLabel: 'good',
					degraded: false,
					generatedAt: '2026-09-15T00:00:00.000Z',
					swapCandidates: pool
				};
				const poolIds = new Set(pool.map((track) => track.id));

				for (const rawIndex of swaps) {
					const index = rawIndex % size;
					const before = structuredClone(set);
					const neighbours = new Set(
						[artistOf(set.tracks[index - 1]), artistOf(set.tracks[index + 1])].filter(Boolean)
					);
					const used = new Set(set.tracks.map((track) => track.id));
					const unused = pool.filter((track) => !used.has(track.id));
					const result = reviewSwap(set, index);

					expect(set).toEqual(before);
					expect(result === null).toBe(unused.length === 0);
					if (!result) continue;

					const next = result.set;
					const ids = next.tracks.map((track) => track.id);
					expect(next.tracks).toHaveLength(size);
					expect(new Set(ids).size).toBe(size);
					expect(ids.every((id) => poolIds.has(id))).toBe(true);
					expect(next.tracks[index]).toBe(result.replacement);
					expect(result.previous).toBe(set.tracks[index]);

					if (unused.some((track) => !neighbours.has(artistOf(track)))) {
						expect(neighbours.has(artistOf(result.replacement))).toBe(false);
					}

					const known = next.tracks.reduce((total, track) => total + (track.duration ?? 0), 0);
					const unknown = next.tracks.filter((track) => track.duration === undefined).length;
					const outside = next.tracks.filter((track) => track.outsideAnchors).length;
					expect(next.knownDurationSeconds).toBe(known);
					expect(next.unknownDurationCount).toBe(unknown);
					expect(next.estimatedDurationSeconds).toBe(
						known + unknown * UNKNOWN_DURATION_ESTIMATE_SECONDS
					);
					expect(next.discoveryPercentage).toBe(Math.round((outside / size) * 100));

					set = next;
				}
			})
		);
	});
});
