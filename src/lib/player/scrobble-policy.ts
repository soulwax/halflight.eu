/**
 * Last.fm accepts a track only after it is longer than 30 seconds and the
 * listener has heard at least half of it or four minutes, whichever comes
 * first. Its separate >30-second playback minimum still applies to short
 * tracks.
 */
export function lastfmScrobbleThreshold(durationSeconds: number): number | null {
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 30) return null;
	return Math.max(30.001, Math.min(durationSeconds / 2, 4 * 60));
}
