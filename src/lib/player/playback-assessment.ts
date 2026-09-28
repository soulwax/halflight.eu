import { m } from '#lib/paraglide/messages.js';
import {
	assessPlayback as assess,
	type PlaybackAssessment as BaseAssessment,
	type PlaybackAssessmentInput,
	type PlaybackIssue
} from 'syn.js/player';

export type {
	PlaybackAssessmentInput,
	PlaybackIssue,
	PlaybackLengthVerdict,
	PlaybackMode
} from 'syn.js/player';

export interface PlaybackAssessment extends BaseAssessment {
	/** Short localised line for the player, or `null` when `ok`. */
	warning: string | null;
}

/** TIDAL's tiers, lowest first. `HI_RES` is the legacy name of `HI_RES_LOSSLESS`. */
const QUALITY_RANK: Record<string, number> = {
	LOW: 0,
	HIGH: 1,
	LOSSLESS: 2,
	HI_RES: 3,
	HI_RES_LOSSLESS: 3
};

function mmss(total: number): string {
	const t = Math.round(total);
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function describeIssue(issue: PlaybackIssue): string {
	switch (issue.code) {
		case 'preview':
			return m.player_issue_preview({
				actual: mmss(issue.actualSeconds),
				expected: mmss(issue.expectedSeconds)
			});
		case 'short':
			return m.player_issue_short({
				actual: mmss(issue.actualSeconds),
				expected: mmss(issue.expectedSeconds)
			});
		case 'long':
			return m.player_issue_long({ actual: mmss(issue.actualSeconds) });
		case 'downgraded':
			return m.player_issue_downgraded({
				requested: issue.requestedQuality,
				delivered: issue.deliveredQuality
			});
	}
}

/** Check what reached the `<audio>` element against the TIDAL catalogue. */
export function assessPlayback(input: PlaybackAssessmentInput): PlaybackAssessment {
	const assessment = assess(input, { qualityRank: QUALITY_RANK });
	return {
		...assessment,
		warning: assessment.issues.length ? assessment.issues.map(describeIssue).join(' · ') : null
	};
}
