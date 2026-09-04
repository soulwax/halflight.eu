import type { GraphCandidateTrack } from './graph';
import type { TasteProfile } from './profile';

export interface FilteredCandidate extends GraphCandidateTrack {
	primaryArtistId: string;
	primaryArtistName: string;
	decade?: number;
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

		// 2. ID deduplication
		if (seenTrackIds.has(track.id)) continue;

		// 3. ISRC deduplication (recording-level dedupe across remasters/singles)
		if (track.isrc) {
			if (seenIsrcs.has(track.isrc)) continue;
			seenIsrcs.add(track.isrc);
		}
		seenTrackIds.add(track.id);

		// 4. Cooldown suppression
		if (cooldownTrackIds.has(track.id)) continue;

		// 5. Exclusions filter
		const primaryArtist = track.artists[0] ?? { id: '', name: '' };
		if (excludedArtists.has(primaryArtist.id)) continue;

		let decade: number | undefined;
		if (track.releaseDate) {
			const year = parseInt(track.releaseDate.slice(0, 4), 10);
			if (!isNaN(year) && year >= 1880 && year <= 2100) {
				decade = Math.floor(year / 10) * 10;
				if (excludedEras.has(decade)) continue;
			}
		}

		filtered.push({
			...track,
			primaryArtistId: primaryArtist.id,
			primaryArtistName: primaryArtist.name || 'Unknown Artist',
			decade
		});
	}

	return filtered;
}
