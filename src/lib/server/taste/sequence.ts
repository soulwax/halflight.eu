import type { ScoredCandidate } from './score';

export interface SequenceOptions {
	targetCount: number;
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

	const pool = [...candidates].sort((a, b) => b.score - a.score);
	const result: ScoredCandidate[] = [];
	const artistCounts = new Map<string, number>();

	// 1. Pick Opener: Highest affinity among top 5 candidates
	const openerCandidates = pool.slice(0, Math.min(5, pool.length));
	openerCandidates.sort((a, b) => b.affinity - a.affinity);
	const opener = openerCandidates[0] ?? pool[0];

	result.push(opener);
	artistCounts.set(opener.primaryArtistId, 1);
	const openerIndex = pool.findIndex((t) => t.id === opener.id);
	if (openerIndex !== -1) pool.splice(openerIndex, 1);

	// 2. Sequentially fill the remaining slots
	while (result.length < targetCount && pool.length > 0) {
		const lastArtistId = result[result.length - 1].primaryArtistId;

		// Try to find the best candidate with a different artist
		let nextIndex = pool.findIndex((c) => c.primaryArtistId !== lastArtistId);

		// If no different artist available, take the top candidate
		if (nextIndex === -1) {
			nextIndex = 0;
		}

		const nextTrack = pool.splice(nextIndex, 1)[0];
		result.push(nextTrack);

		const currentCount = artistCounts.get(nextTrack.primaryArtistId) ?? 0;
		artistCounts.set(nextTrack.primaryArtistId, currentCount + 1);
	}

	return result;
}
