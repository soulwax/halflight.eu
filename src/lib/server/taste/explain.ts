import { m } from '#lib/paraglide/messages.js';
import type { ConfidenceLabel } from '#lib/taste/provisional';
import type { ScoredCandidate } from './score';
import type { TasteProfile } from './profile';

export interface SetExplanation {
	summary: string;
	trackCount: number;
	totalDurationFormatted: string;
	totalDurationSeconds: number;
	discoveryPercentage: number;
	confidenceLabel: ConfidenceLabel;
	degraded: boolean;
}

/** The localised display label for a confidence token. */
export function confidenceText(label: ConfidenceLabel): string {
	switch (label) {
		case 'high':
			return m.generate_confidence_high();
		case 'good':
			return m.generate_confidence_good();
		case 'initial':
			return m.generate_confidence_initial();
		case 'none':
			return m.generate_confidence_none();
	}
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
 * Generates an explainable provenance chip for an individual track. Rendered in
 * the request locale — `explainSet`/`explainTrack` run inside the `?/generate`
 * action, which `paraglideMiddleware` has already scoped.
 */
export function explainTrack(track: ScoredCandidate, profile: TasteProfile): string {
	const seed = track.provenance.seedArtistName || track.primaryArtistName;
	const year = track.releaseDate ? track.releaseDate.slice(0, 4) : undefined;

	let base: string;
	if (track.provenance.edge === 'anchor') {
		const override = profile.overrides.artists[track.primaryArtistId];
		base =
			override === 'pinned'
				? m.taste_provenance_pinned({ artist: track.primaryArtistName })
				: m.taste_provenance_anchor({ artist: track.primaryArtistName });
	} else if (track.provenance.edge === 'similar_artist') {
		base = m.taste_provenance_similar({ seed });
	} else {
		base = m.taste_provenance_profile();
	}

	return year ? `${base} · ${year}` : base;
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
	let confidenceLabel: ConfidenceLabel = 'good';
	if (degraded || avgConfidence < 0.3) {
		confidenceLabel = 'initial';
	} else if (avgConfidence >= 0.7) {
		confidenceLabel = 'high';
	}

	const summary = m.taste_set_summary({
		count: trackCount,
		duration: totalDurationFormatted,
		discovery: discoveryPercentage,
		confidence: confidenceText(confidenceLabel)
	});

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
