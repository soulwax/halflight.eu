import {
	UNKNOWN_DURATION_ESTIMATE_SECONDS,
	type ConfidenceLabel,
	type ProvenanceReason
} from '#lib/taste/provisional';
import type { ScoredCandidate } from './score';
import type { TasteProfile } from './profile';

export interface SetExplanation {
	trackCount: number;
	knownDurationSeconds: number;
	unknownDurationCount: number;
	estimatedDurationSeconds: number;
	discoveryPercentage: number;
	confidenceLabel: ConfidenceLabel;
	degraded: boolean;
}

export { UNKNOWN_DURATION_ESTIMATE_SECONDS };

/** Artist affinity below this counts as outside the owner's anchors. */
export const ANCHOR_AFFINITY_THRESHOLD = 0.25;

/** The one definition of "outside your anchors", shared by set summaries and review flags. */
export function isOutsideAnchors(artistId: string, profile: TasteProfile): boolean {
	return (profile.artists[artistId] ?? 0) < ANCHOR_AFFINITY_THRESHOLD;
}

/**
 * Creates locale-neutral provenance. Presentation code resolves its message in
 * the active locale, so pure generation can be tested independently of i18n.
 */
export function explainTrack(track: ScoredCandidate, profile: TasteProfile): ProvenanceReason {
	const year = track.releaseDate ? track.releaseDate.slice(0, 4) : undefined;

	if (track.provenance.edge === 'anchor') {
		const override = profile.overrides.artists[track.primaryArtistId];
		return {
			code: override === 'pinned' ? 'pinned_artist' : 'anchor_artist',
			artistId: track.primaryArtistId,
			artistName: track.primaryArtistName,
			...(year ? { releaseYear: year } : {})
		};
	}

	if (track.provenance.edge === 'similar_artist') {
		return {
			code: 'similar_artist',
			seedArtistId: track.provenance.seedArtistId,
			seedArtistName: track.provenance.seedArtistName || track.primaryArtistName,
			...(year ? { releaseYear: year } : {})
		};
	}

	return { code: 'profile_match', ...(year ? { releaseYear: year } : {}) };
}

/**
 * Synthesizes the overall set explanation and metrics.
 */
export function explainSet(
	tracks: ScoredCandidate[],
	profile: TasteProfile,
	degraded: boolean
): SetExplanation {
	const trackCount = tracks.length;
	const knownDurationSeconds = tracks.reduce((acc, current) => acc + (current.duration ?? 0), 0);
	const unknownDurationCount = tracks.filter((track) => track.duration === undefined).length;
	const estimatedDurationSeconds =
		knownDurationSeconds + unknownDurationCount * UNKNOWN_DURATION_ESTIMATE_SECONDS;

	// Discovery share: picks outside the owner's anchors.
	const discoveryCount = tracks.filter((t) => isOutsideAnchors(t.primaryArtistId, profile)).length;

	const discoveryPercentage = trackCount > 0 ? Math.round((discoveryCount / trackCount) * 100) : 0;

	// Assess overall confidence
	const avgConfidence = (profile.confidence.artists + profile.confidence.eras) / 2;
	let confidenceLabel: ConfidenceLabel = 'good';
	if (degraded || avgConfidence < 0.3) {
		confidenceLabel = 'initial';
	} else if (avgConfidence >= 0.7) {
		confidenceLabel = 'high';
	}

	return {
		trackCount,
		knownDurationSeconds,
		unknownDurationCount,
		estimatedDurationSeconds,
		discoveryPercentage,
		confidenceLabel,
		degraded
	};
}
