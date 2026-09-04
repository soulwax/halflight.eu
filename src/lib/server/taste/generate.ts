import type { TasteProfile } from './profile';
import { expandTasteGraph, type GraphExpansionBudget, type GraphExpansionClient } from './graph';
import { filterCandidates } from './candidates';
import { scoreCandidates } from './score';
import { sequenceCandidates } from './sequence';
import { explainTrack, explainSet, type SetExplanation } from './explain';

export interface GenerateKnobs {
	targetCount?: number;
	familiarity?: number;
	seedArtistId?: string;
}

export interface ProvisionalTrack {
	id: string;
	title: string;
	artists: Array<{ id: string; name: string }>;
	duration?: number;
	releaseDate?: string;
	provenance: string;
}

export interface ProvisionalSet extends SetExplanation {
	tracks: ProvisionalTrack[];
	generatedAt: string;
}

export interface GenerateTasteSetOptions {
	knobs?: GenerateKnobs;
	client: GraphExpansionClient;
	budget?: GraphExpansionBudget;
	cooldownTrackIds?: Set<string>;
	now?: Date;
}

/**
 * The Taste Engine Orchestrator:
 * Executes the full deterministic 4-stage pipeline:
 * Expansion -> Candidates/ISRC-dedupe -> Scoring -> Sequencing -> Provenance Synthesis
 */
export async function generateTasteSet(
	profile: TasteProfile,
	options: GenerateTasteSetOptions
): Promise<ProvisionalSet> {
	const now = options.now ?? new Date();
	const targetCount = options.knobs?.targetCount ?? 20;
	const familiarity = options.knobs?.familiarity ?? profile.knobDefaults.familiarity ?? 50;

	// 1. Determine anchor seeds
	const anchors: Array<{ id: string; name?: string; weight: number }> = options.knobs?.seedArtistId
		? [{ id: options.knobs.seedArtistId, weight: 1 }]
		: Object.entries(profile.artists)
				.map(([id, weight]) => ({ id, weight }))
				.sort((a, b) => b.weight - a.weight);

	// Cold-start guard: If profile has zero anchors
	if (anchors.length === 0) {
		return {
			tracks: [],
			summary: 'No anchor signals available in profile. Please rebuild your profile from TIDAL.',
			trackCount: 0,
			totalDurationFormatted: '0m',
			totalDurationSeconds: 0,
			discoveryPercentage: 0,
			confidenceLabel: 'None',
			degraded: true,
			generatedAt: now.toISOString()
		};
	}

	// 2. Stage 3 — Budgeted Graph Expansion
	const expansion = await expandTasteGraph(anchors, options.client, options.budget);

	// 3. Stage 4a — Candidates assembly & ISRC deduplication
	const filtered = filterCandidates(expansion.candidates, profile, options.cooldownTrackIds);

	// 4. Stage 4b — Transparent Multi-term Scoring
	const scored = scoreCandidates(filtered, profile, { familiarity });

	// 5. Stage 4c — Energy / Spacing Sequencing
	const sequenced = sequenceCandidates(scored, { targetCount });

	// 6. Stage 4d — Explainability & Provenance chips
	const tracks: ProvisionalTrack[] = sequenced.map((track) => ({
		id: track.id,
		title: track.title,
		artists: track.artists,
		duration: track.duration,
		releaseDate: track.releaseDate,
		provenance: explainTrack(track, profile)
	}));

	const explanation = explainSet(sequenced, profile, expansion.degraded);

	return {
		...explanation,
		tracks,
		generatedAt: now.toISOString()
	};
}
