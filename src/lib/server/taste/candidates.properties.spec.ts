import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { filterCandidates } from './candidates';
import type { GraphCandidateTrack } from './graph';
import { emptyTasteProfile } from './profile';

const artistIds = fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 3 });
const candidateTrack = fc
	.record({
		id: fc.uuid(),
		isrc: fc.option(fc.uuid(), { nil: undefined }),
		releaseDate: fc.constantFrom(undefined, '1985-01-01', '1999-06-15', '2024-12-31'),
		artistIds,
		seedArtistId: fc.uuid(),
		edge: fc.constantFrom<'anchor' | 'similar_artist'>('anchor', 'similar_artist')
	})
	.map(
		({ id, isrc, releaseDate, artistIds: artists, seedArtistId, edge }): GraphCandidateTrack => ({
			id,
			title: `Track ${id}`,
			...(isrc ? { isrc } : {}),
			...(releaseDate ? { releaseDate } : {}),
			artists: artists.map((artistId) => ({ id: artistId, name: `Artist ${artistId}` })),
			provenance: { edge, seedArtistId }
		})
	);

function decade(track: GraphCandidateTrack): number | undefined {
	if (!track.releaseDate) return undefined;
	const year = Number.parseInt(track.releaseDate.slice(0, 4), 10);
	return Number.isInteger(year) ? Math.floor(year / 10) * 10 : undefined;
}

describe('candidate filtering invariants', () => {
	it('never mutates input or returns ineligible, duplicate IDs or ISRCs', () => {
		fc.assert(
			fc.property(fc.array(candidateTrack, { maxLength: 40 }), (raw) => {
				const original = raw.map((track) => ({
					...track,
					artists: track.artists.map((artist) => ({ ...artist })),
					provenance: { ...track.provenance }
				}));
				const profile = emptyTasteProfile();
				profile.exclusions.artists = raw
					.flatMap((track) => track.artists.map((artist) => artist.id))
					.filter((_, index) => index % 4 === 0);
				profile.exclusions.eras = [1980, 2020];
				const cooldown = new Set(
					raw.filter((_, index) => index % 5 === 0).map((track) => track.id)
				);

				const filtered = filterCandidates(raw, profile, cooldown);

				expect(raw).toEqual(original);
				expect(new Set(filtered.map((track) => track.id)).size).toBe(filtered.length);
				expect(new Set(filtered.flatMap((track) => (track.isrc ? [track.isrc] : []))).size).toBe(
					filtered.filter((track) => track.isrc).length
				);
				expect(
					filtered.every(
						(track) =>
							!cooldown.has(track.id) &&
							track.artists.every((artist) => !profile.exclusions.artists.includes(artist.id)) &&
							(decade(track) === undefined || !profile.exclusions.eras.includes(decade(track)!))
					)
				).toBe(true);
			}),
			{ numRuns: 200 }
		);
	});
});
