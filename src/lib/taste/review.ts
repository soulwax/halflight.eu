import {
	UNKNOWN_DURATION_ESTIMATE_SECONDS,
	type ProvisionalSet,
	type ProvisionalTrack
} from './provisional';

export interface ReviewSwap {
	set: ProvisionalSet;
	index: number;
	previous: ProvisionalTrack;
	replacement: ProvisionalTrack;
}

function primaryArtistId(track: ProvisionalTrack | undefined): string | undefined {
	return track?.artists[0]?.id;
}

/**
 * The next replacement for one slot, drawn from the set's response-local pool.
 *
 * The scan starts just after the slot's current track and wraps around, so
 * repeated swaps rotate through the whole pool instead of toggling between the
 * current track and the first unused one. A candidate whose primary artist
 * differs from both neighbouring slots wins; spacing yields only when nothing
 * else is left. Tracks already in the set are never offered.
 */
export function findSwapCandidate(set: ProvisionalSet, index: number): ProvisionalTrack | null {
	const current = set.tracks[index];
	const pool = set.swapCandidates ?? [];
	if (!current || pool.length === 0) return null;

	const used = new Set(set.tracks.map((track) => track.id));
	// A current track missing from the pool starts the scan at the top.
	const start = pool.findIndex((track) => track.id === current.id) + 1;
	const neighbours = new Set(
		[primaryArtistId(set.tracks[index - 1]), primaryArtistId(set.tracks[index + 1])].filter(
			(artistId): artistId is string => artistId !== undefined
		)
	);

	let fallback: ProvisionalTrack | null = null;
	for (let offset = 0; offset < pool.length; offset++) {
		const candidate = pool[(start + offset) % pool.length];
		if (!candidate || used.has(candidate.id)) continue;
		const artistId = primaryArtistId(candidate);
		if (artistId === undefined || !neighbours.has(artistId)) return candidate;
		fallback ??= candidate;
	}
	return fallback;
}

/** Replace one reviewed slot without mutating the original provisional set. */
export function swapProvisionalTrack(
	set: ProvisionalSet,
	index: number,
	replacement: ProvisionalTrack
): ProvisionalSet | null {
	if (!Number.isInteger(index) || index < 0 || index >= set.tracks.length) return null;
	if (set.tracks[index]?.id === replacement.id) return null;
	if (set.tracks.some((track, trackIndex) => trackIndex !== index && track.id === replacement.id)) {
		return null;
	}

	const tracks = set.tracks.map((track, trackIndex) =>
		trackIndex === index ? replacement : track
	);
	const knownDurationSeconds = tracks.reduce((total, track) => total + (track.duration ?? 0), 0);
	const unknownDurationCount = tracks.filter((track) => track.duration === undefined).length;
	const hasAffinityFlags = tracks.every((track) => track.outsideAnchors !== undefined);
	const discoveryPercentage = hasAffinityFlags
		? Math.round((tracks.filter((track) => track.outsideAnchors).length / tracks.length) * 100)
		: set.discoveryPercentage;

	return {
		...set,
		tracks,
		knownDurationSeconds,
		unknownDurationCount,
		estimatedDurationSeconds:
			knownDurationSeconds + unknownDurationCount * UNKNOWN_DURATION_ESTIMATE_SECONDS,
		discoveryPercentage
	};
}

/** Swap one slot for its next deterministic candidate, or `null` when none remains. */
export function reviewSwap(set: ProvisionalSet, index: number): ReviewSwap | null {
	const previous = set.tracks[index];
	const replacement = findSwapCandidate(set, index);
	if (!previous || !replacement) return null;

	const next = swapProvisionalTrack(set, index, replacement);
	return next ? { set: next, index, previous, replacement } : null;
}
