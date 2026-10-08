/** Server clock only: bound extrapolation when a device stops reporting progress. */
export function projectPlaybackPosition(
	position: number,
	sampledAt: number,
	playing: boolean,
	now: number,
	leaseExpiresAt: number,
	duration?: number
): number {
	const safe = Number.isFinite(position) ? Math.max(0, position) : 0;
	const elapsed =
		playing && Number.isFinite(sampledAt) && Number.isFinite(leaseExpiresAt)
			? Math.min(10, Math.max(0, (Math.min(now, leaseExpiresAt) - sampledAt) / 1000))
			: 0;
	const projected = safe + elapsed;
	return Number.isFinite(duration) && duration! > 0 ? Math.min(duration!, projected) : projected;
}
