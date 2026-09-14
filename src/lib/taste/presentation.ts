import { m } from '#lib/paraglide/messages.js';
import type { ConfidenceLabel, ProvisionalSet, ProvenanceReason } from './provisional.js';

function formatDuration(seconds: number): string {
	const minutes = Math.max(0, Math.floor(seconds / 60));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function localizeConfidence(label: ConfidenceLabel): string {
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

/** Render a structured generation reason in the active UI locale. */
export function localizeProvenanceReason(reason: ProvenanceReason): string {
	let text: string;
	switch (reason.code) {
		case 'pinned_artist':
			text = m.taste_provenance_pinned({ artist: reason.artistName });
			break;
		case 'anchor_artist':
			text = m.taste_provenance_anchor({ artist: reason.artistName });
			break;
		case 'similar_artist':
			text = m.taste_provenance_similar({ seed: reason.seedArtistName });
			break;
		case 'profile_match':
			text = m.taste_provenance_profile();
			break;
	}

	return reason.releaseYear ? `${text} · ${reason.releaseYear}` : text;
}

/**
 * A duration label never disguises an estimate as provider-supplied runtime.
 */
export function localizeSetDuration(
	set: Pick<ProvisionalSet, 'estimatedDurationSeconds' | 'unknownDurationCount'>
): string {
	const duration = formatDuration(set.estimatedDurationSeconds);
	return set.unknownDurationCount > 0 ? m.generate_duration_approximate({ duration }) : duration;
}

export function localizeDurationCoverage(
	set: Pick<ProvisionalSet, 'trackCount' | 'unknownDurationCount'>
): string | null {
	if (set.unknownDurationCount === 0) return null;
	return m.generate_duration_estimated_detail({
		known: Math.max(0, set.trackCount - set.unknownDurationCount),
		unknown: set.unknownDurationCount
	});
}

export function localizeSetSummary(
	set: Pick<
		ProvisionalSet,
		| 'trackCount'
		| 'estimatedDurationSeconds'
		| 'unknownDurationCount'
		| 'discoveryPercentage'
		| 'confidenceLabel'
	>
): string {
	return m.taste_set_summary({
		count: set.trackCount,
		duration: localizeSetDuration(set),
		discovery: set.discoveryPercentage,
		confidence: localizeConfidence(set.confidenceLabel)
	});
}
