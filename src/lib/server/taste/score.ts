import type { FilteredCandidate } from './candidates';
import type { TasteProfile } from './profile';

export interface ScoredCandidate extends FilteredCandidate {
	affinity: number;
	novelty: number;
	score: number;
}

export interface ScoreOptions {
	familiarity: number; // 0 (100% discovery) to 100 (100% familiar)
	artistCounts?: Map<string, number>; // for dynamic penalty calculation
}

/**
 * Pure scoring function over a candidate track:
 * score = affinity * w_fam + novelty * w_disc - artistCountPenalty
 */
export function scoreCandidate(
	candidate: FilteredCandidate,
	profile: TasteProfile,
	options: ScoreOptions
): ScoredCandidate {
	const familiarity = Math.max(0, Math.min(100, options.familiarity));
	const wFam = familiarity / 100;
	const wDisc = 1 - wFam;

	// 1. Calculate Affinity
	const artistAffinity = profile.artists[candidate.primaryArtistId] ?? 0;
	let eraAffinity = 0.5; // neutral default if unknown
	if (candidate.decade) {
		eraAffinity = profile.eras[String(candidate.decade)] ?? 0;
	}
	const affinity = Number((artistAffinity * 0.75 + eraAffinity * 0.25).toFixed(3));

	// 2. Calculate Novelty (directional distance)
	// Unfamiliar tracks linked to strong seeds score high; unfamiliar unlinked score low.
	const seedAffinity = profile.artists[candidate.provenance.seedArtistId] ?? 0.5;
	const unfamiliarity = 1 - artistAffinity;
	const novelty = Number((unfamiliarity * seedAffinity).toFixed(3));

	// 3. Penalty for artist over-representation
	const count = options.artistCounts?.get(candidate.primaryArtistId) ?? 0;
	const penalty = count * 0.35;

	// 4. Combined transparent score
	const score = Number((affinity * wFam + novelty * wDisc - penalty).toFixed(4));

	return {
		...candidate,
		affinity,
		novelty,
		score
	};
}

/**
 * Score a list of candidates against the profile and options
 */
export function scoreCandidates(
	candidates: FilteredCandidate[],
	profile: TasteProfile,
	options: ScoreOptions
): ScoredCandidate[] {
	return candidates.map((c) => scoreCandidate(c, profile, options));
}
