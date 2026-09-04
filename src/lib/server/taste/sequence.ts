import { ARTIST_REPEAT_PENALTY, type ScoredCandidate } from './score';

export interface SequenceOptions {
	targetCount: number;
}

function compareIdentifiers(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function compareByBaseScore(a: ScoredCandidate, b: ScoredCandidate): number {
	return b.score - a.score || compareIdentifiers(a.id, b.id);
}

function selectNextCandidate(
	pool: ScoredCandidate[],
	artistCounts: Map<string, number>,
	lastArtistId: string
): number {
	const alternatives = pool.filter((candidate) => candidate.primaryArtistId !== lastArtistId);
	const choices = alternatives.length > 0 ? alternatives : pool;
	let selected = choices[0];
	let selectedEffectiveScore =
		selected.score - (artistCounts.get(selected.primaryArtistId) ?? 0) * ARTIST_REPEAT_PENALTY;

	for (const candidate of choices.slice(1)) {
		const effectiveScore =
			candidate.score - (artistCounts.get(candidate.primaryArtistId) ?? 0) * ARTIST_REPEAT_PENALTY;
		if (
			effectiveScore > selectedEffectiveScore ||
			(effectiveScore === selectedEffectiveScore &&
				compareIdentifiers(candidate.id, selected.id) < 0)
		) {
			selected = candidate;
			selectedEffectiveScore = effectiveScore;
		}
	}

	return pool.findIndex((candidate) => candidate.id === selected.id);
}

/**
 * Pure sequencing logic:
 * - Selects an opener with high affinity to earn trust first.
 * - Enforces artist spacing (no back-to-back same artist).
 * - Distributes unfamiliar items smoothly across the set.
 */
export function sequenceCandidates(
	candidates: ScoredCandidate[],
	options: SequenceOptions
): ScoredCandidate[] {
	if (candidates.length === 0) return [];
	const targetCount = Math.max(1, Math.min(candidates.length, options.targetCount));

	const pool = [...candidates].sort(compareByBaseScore);
	const result: ScoredCandidate[] = [];
	const artistCounts = new Map<string, number>();

	// 1. Pick Opener: Highest affinity among top 5 candidates
	const openerCandidates = pool.slice(0, Math.min(5, pool.length));
	openerCandidates.sort(
		(a, b) => b.affinity - a.affinity || b.score - a.score || compareIdentifiers(a.id, b.id)
	);
	const opener = openerCandidates[0] ?? pool[0];

	result.push(opener);
	artistCounts.set(opener.primaryArtistId, 1);
	const openerIndex = pool.findIndex((t) => t.id === opener.id);
	if (openerIndex !== -1) pool.splice(openerIndex, 1);

	// 2. Sequentially fill the remaining slots
	while (result.length < targetCount && pool.length > 0) {
		const lastArtistId = result[result.length - 1].primaryArtistId;

		const nextIndex = selectNextCandidate(pool, artistCounts, lastArtistId);
		const nextTrack = pool.splice(nextIndex, 1)[0];
		result.push(nextTrack);

		const currentCount = artistCounts.get(nextTrack.primaryArtistId) ?? 0;
		artistCounts.set(nextTrack.primaryArtistId, currentCount + 1);
	}

	return result;
}
