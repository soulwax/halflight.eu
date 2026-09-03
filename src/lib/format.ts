/** Shared display formatters. Pure, client-safe. */

function clock(totalSeconds: number): string {
	const total = Math.floor(totalSeconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
	return hours > 0
		? `${hours}:${mm}:${String(seconds).padStart(2, '0')}`
		: `${mm}:${String(seconds).padStart(2, '0')}`;
}

/**
 * A track/media duration as `m:ss` (or `h:mm:ss` past an hour). Returns `''` when
 * the value is missing, zero, or invalid — use in listings where a blank cell is
 * fine and a zero-length track means "unknown".
 */
export function formatDuration(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
	return clock(seconds);
}

/**
 * A playback position as `m:ss` (or `h:mm:ss` past an hour). Always renders,
 * falling back to `0:00` — use for player time displays that must not be blank.
 */
export function formatClock(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
	return clock(seconds);
}

export type QualityTier = 'lossy' | 'lossless' | 'hires';

/**
 * Group a TIDAL audio-quality string into a tier so badges can colour by fidelity
 * (grey lossy / cyan lossless / gold HiRes), mirroring tiddl's CLI colour scheme.
 */
export function qualityTier(quality: string | null | undefined): QualityTier {
	const q = quality?.toUpperCase();
	if (q === 'HI_RES_LOSSLESS' || q === 'HI_RES') return 'hires';
	if (q === 'LOSSLESS') return 'lossless';
	return 'lossy';
}
