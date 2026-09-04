import type { ScoredCandidate } from './score';
import type { TasteProfile } from './profile';

export interface SetExplanation {
	summary: string;
	trackCount: number;
	totalDurationFormatted: string;
	totalDurationSeconds: number;
	discoveryPercentage: number;
	confidenceLabel: string;
	degraded: boolean;
}

/**
 * Format duration in seconds to "Xm" or "Xh Ym"
 */
function formatDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

/**
 * Generates an explainable provenance chip for an individual track.
 */
export function explainTrack(track: ScoredCandidate, profile: TasteProfile): string {
	const seedName = track.provenance.seedArtistName || 'your library';
	const year = track.releaseDate ? track.releaseDate.slice(0, 4) : undefined;
	const yearPart = year ? ` · ${year}` : '';

	if (track.provenance.edge === 'anchor') {
		const override = profile.overrides.artists[track.primaryArtistId];
		if (override === 'pinned') {
			return `From your pinned artist ${track.primaryArtistName}${yearPart}`;
		}
		return `From your anchor artist ${track.primaryArtistName}${yearPart}`;
	}

	if (track.provenance.edge === 'similar_artist') {
		return `Similar to ${seedName}${yearPart}`;
	}

	return `Matched to your taste profile${yearPart}`;
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
	const totalDurationSeconds = tracks.reduce((acc, curr) => acc + (curr.duration ?? 210), 0);
	const totalDurationFormatted = formatDuration(totalDurationSeconds);

	// Calculate discovery share (tracks not in profile anchors)
	const discoveryCount = tracks.filter(
		(t) => (profile.artists[t.primaryArtistId] ?? 0) < 0.25
	).length;

	const discoveryPercentage = trackCount > 0 ? Math.round((discoveryCount / trackCount) * 100) : 0;

	// Assess overall confidence
	const avgConfidence = (profile.confidence.artists + profile.confidence.eras) / 2;
	let confidenceLabel = 'Good';
	if (degraded || avgConfidence < 0.3) {
		confidenceLabel = 'Initial / Partial';
	} else if (avgConfidence >= 0.7) {
		confidenceLabel = 'High';
	}

	const summary = `SET · ${trackCount} tracks · ${totalDurationFormatted} · ${discoveryPercentage}% new to you · confidence: ${confidenceLabel.toLowerCase()}`;

	return {
		summary,
		trackCount,
		totalDurationFormatted,
		totalDurationSeconds,
		discoveryPercentage,
		confidenceLabel,
		degraded
	};
}
