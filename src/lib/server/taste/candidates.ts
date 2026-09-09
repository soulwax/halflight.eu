import type { GraphCandidateTrack } from './graph';
import type { TasteProfile } from './profile';

export interface FilteredCandidate extends GraphCandidateTrack {
	primaryArtistId: string;
	primaryArtistName: string;
	/** Release decade, e.g. 2010 — used for era exclusions and era affinity. */
	decade?: number;
	/** Release year, e.g. 2017 — used for the era-window request-fit term. */
	year?: number;
}

/**
 * Deduplicate by ISRC & Track ID, and filter out exclusions and cooldowns.
 */
export function filterCandidates(
	raw: GraphCandidateTrack[],
	profile: TasteProfile,
	cooldownTrackIds: Set<string> = new Set()
): FilteredCandidate[] {
	const seenIsrcs = new Set<string>();
	const seenTrackIds = new Set<string>();
	const filtered: FilteredCandidate[] = [];

	const excludedArtists = new Set(profile.exclusions.artists);
	const excludedEras = new Set(profile.exclusions.eras);

	for (const track of raw) {
		// 1. Basic validity
		if (!track.id || !track.title) continue;

		// 2. Eligibility must happen before recording-level deduplication. An
		// ineligible variant must not suppress an eligible remaster or release.
		if (cooldownTrackIds.has(track.id)) continue;
		if (track.artists.some((artist) => excludedArtists.has(artist.id))) continue;

		const primaryArtist = track.artists[0] ?? { id: '', name: '' };

		let decade: number | undefined;
		let year: number | undefined;
		if (track.releaseDate) {
			const parsedYear = parseInt(track.releaseDate.slice(0, 4), 10);
			if (!isNaN(parsedYear) && parsedYear >= 1880 && parsedYear <= 2100) {
				year = parsedYear;
				decade = Math.floor(parsedYear / 10) * 10;
				if (excludedEras.has(decade)) continue;
			}
		}

		// 3. ID and ISRC deduplication apply only to candidates that are eligible
		// for this set. This keeps fallback variants available.
		if (seenTrackIds.has(track.id)) continue;
		if (track.isrc && seenIsrcs.has(track.isrc)) continue;
		seenTrackIds.add(track.id);
		if (track.isrc) seenIsrcs.add(track.isrc);

		filtered.push({
			...track,
			primaryArtistId: primaryArtist.id,
			primaryArtistName: primaryArtist.name || 'Unknown Artist',
			decade,
			year
		});
	}

	return filtered;
}
