import type { ConfidenceLabel, ProvenanceReason } from '#lib/taste/provisional';
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

/** Used only to make an incomplete set's displayed runtime approximately useful. */
export const UNKNOWN_DURATION_ESTIMATE_SECONDS = 210;

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

	// Calculate discovery share (tracks not in profile anchors)
	const discoveryCount = tracks.filter(
		(t) => (profile.artists[t.primaryArtistId] ?? 0) < 0.25
	).length;

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
