/**
 * Automatic playback self-checks: does the audio the browser actually received
 * match what the catalogue promised (length) and what was requested (quality)?
 *
 * The engine feeds this the catalogue duration, the `<audio>` element's real
 * `duration`, the requested quality tier and the delivered tier/codec; it
 * returns a verdict the player surfaces as a badge. Everything here is pure so
 * it is fully unit-testable without a browser or a TIDAL connection.
 */

export type PlaybackLengthVerdict = 'match' | 'short' | 'long' | 'unknown';
export type PlaybackMode = 'direct' | 'embed';

export interface PlaybackAssessmentInput {
	/** Track length from the TIDAL catalogue, seconds. */
	expectedSeconds?: number | null;
	/** `HTMLAudioElement.duration` once media metadata has loaded, seconds. */
	actualSeconds?: number | null;
	/** Quality tier asked of the API (`LOW` | `HIGH` | `LOSSLESS` | …). */
	requestedQuality?: string | null;
	/** Quality tier the API said it delivered. */
	deliveredQuality?: string | null;
	/** Delivered codec (`flac`, `mp4a.40.2`, `eac3`, …). */
	codecs?: string | null;
	/** `embed` playback is a black box — length/quality cannot be asserted. */
	mode?: PlaybackMode;
}

export interface PlaybackAssessment {
	length: PlaybackLengthVerdict;
	/** `actualSeconds / expectedSeconds`, or `null` when either is unknown. */
	lengthRatio: number | null;
	expectedSeconds: number | null;
	actualSeconds: number | null;
	/** Stream is a fraction of the catalogue length and short in absolute terms. */
	isLikelyPreview: boolean;
	requestedQuality: string | null;
	deliveredQuality: string | null;
	/** Delivered tier is below the requested tier. */
	downgraded: boolean;
	lossless: boolean;
	/** `true` when nothing is wrong. */
	ok: boolean;
	/** Short human line for the player, or `null` when `ok`. */
	warning: string | null;
}

const QUALITY_RANK: Record<string, number> = {
	LOW: 0,
	HIGH: 1,
	LOSSLESS: 2,
	HI_RES: 3,
	HI_RES_LOSSLESS: 3
};

const SHORT_RATIO = 0.9;
const LONG_RATIO = 1.15;
const PREVIEW_RATIO = 0.6;
const PREVIEW_MAX_SECONDS = 45;

function finitePositive(value: number | null | undefined): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normQuality(value: string | null | undefined): string | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	return value.trim().toUpperCase();
}

function mmss(total: number): string {
	const t = Math.round(total);
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function assessPlayback(input: PlaybackAssessmentInput): PlaybackAssessment {
	const expectedSeconds = finitePositive(input.expectedSeconds);
	const actualSeconds = finitePositive(input.actualSeconds);
	const requestedQuality = normQuality(input.requestedQuality);
	const deliveredQuality = normQuality(input.deliveredQuality);
	const lossless = input.codecs === 'flac';
	const embed = input.mode === 'embed';

	let length: PlaybackLengthVerdict = 'unknown';
	let lengthRatio: number | null = null;
	let isLikelyPreview = false;

	if (expectedSeconds && actualSeconds) {
		lengthRatio = actualSeconds / expectedSeconds;
		if (lengthRatio < SHORT_RATIO) length = 'short';
		else if (lengthRatio > LONG_RATIO) length = 'long';
		else length = 'match';
		isLikelyPreview = lengthRatio < PREVIEW_RATIO && actualSeconds <= PREVIEW_MAX_SECONDS;
	}

	const reqRank = requestedQuality != null ? QUALITY_RANK[requestedQuality] : undefined;
	const delRank = deliveredQuality != null ? QUALITY_RANK[deliveredQuality] : undefined;
	const downgraded = reqRank != null && delRank != null && delRank < reqRank;

	const issues: string[] = [];
	if (!embed) {
		if (isLikelyPreview && expectedSeconds && actualSeconds) {
			issues.push(`Preview only — ${mmss(actualSeconds)} of ${mmss(expectedSeconds)}`);
		} else if (length === 'short' && expectedSeconds && actualSeconds) {
			issues.push(`Stream is short — ${mmss(actualSeconds)} of ${mmss(expectedSeconds)}`);
		} else if (length === 'long' && expectedSeconds && actualSeconds) {
			issues.push(`Stream runs past the catalogue length (${mmss(actualSeconds)})`);
		}
		if (downgraded) {
			issues.push(`Quality: asked ${requestedQuality}, got ${deliveredQuality}`);
		}
	}

	return {
		length,
		lengthRatio,
		expectedSeconds,
		actualSeconds,
		isLikelyPreview,
		requestedQuality,
		deliveredQuality,
		downgraded,
		lossless,
		ok: issues.length === 0,
		warning: issues.length ? issues.join(' · ') : null
	};
}
