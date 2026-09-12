import type { FilteredCandidate } from './candidates';
import type { TasteProfile } from './profile';

/**
 * How much each prior pick of the same artist discounts a later candidate.
 * Defined here (re-exported for `sequence.ts`) because it is conceptually a
 * scoring weight, but *applied* only by `sequence.ts` — see the note on
 * {@link ScoreOptions}.
 */
export const ARTIST_REPEAT_PENALTY = 0.35;

/** How much a fully-in-window (or fully-out-of-window) era fit moves the score. */
export const ERA_FIT_WEIGHT = 0.4;

export interface ScoredCandidate extends FilteredCandidate {
	affinity: number;
	novelty: number;
	/** Era-window request fit, 0–1 (0.5 = neutral / not requested / unknown year). */
	fit: number;
	score: number;
}

export interface EraWindow {
	/** Target year the set should centre on, e.g. 2016. */
	center: number;
	/** Half-width in years; fit decays to 0 at this distance from the centre. */
	spread: number;
}

export interface ScoreOptions {
	familiarity: number; // 0 (100% discovery) to 100 (100% familiar)
	era?: EraWindow; // optional era-window request-fit term
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

	// 3. Era-window request fit (directional): 1 at the requested centre year,
	// decaying linearly to 0 at the window edge, 0 beyond. Stays neutral (0.5)
	// when no era is requested or the track's year is unknown, so it only ever
	// nudges — it never silently drops an undated track.
	let fit = 0.5;
	if (options.era && candidate.year !== undefined) {
		const spread = Math.max(1, options.era.spread);
		const distance = Math.abs(candidate.year - options.era.center);
		fit = Math.max(0, 1 - distance / spread);
	}

	// 4. Combined transparent score. No artist-repeat penalty here: this
	// function scores one candidate against the profile, before any selection
	// order exists, so it has nothing to count occurrences *of*. That penalty
	// is `sequence.ts`'s job — it knows how many times an artist has already
	// been chosen as of this point in the set, which a pre-selection snapshot
	// passed in here never could reflect accurately once picks start excluding
	// candidates from the pool.
	const score = Number(
		(affinity * wFam + novelty * wDisc + (fit - 0.5) * ERA_FIT_WEIGHT).toFixed(4)
	);

	return {
		...candidate,
		affinity,
		novelty,
		fit: Number(fit.toFixed(3)),
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
