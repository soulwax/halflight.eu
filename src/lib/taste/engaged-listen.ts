/** Counts audible progress conservatively, including background playback but excluding seek jumps. */
export class EngagedListenTracker {
	seconds = 0;
	private position = 0;
	private observedAt = 0;
	reset(position = 0, now = Date.now()): void {
		this.seconds = 0;
		this.rebase(position, now);
	}
	rebase(position: number, now = Date.now()): void {
		this.position = position;
		this.observedAt = now;
	}
	observe(position: number, playing: boolean, sourceMatches: boolean, now = Date.now()): number {
		const progress = position - this.position;
		const wallSeconds = (now - this.observedAt) / 1000;
		this.rebase(position, now);
		if (
			!Number.isFinite(progress) ||
			!playing ||
			!sourceMatches ||
			progress <= 0 ||
			wallSeconds <= 0 ||
			progress > wallSeconds * 1.15 + 0.5
		)
			return this.seconds;
		this.seconds += Math.min(progress, wallSeconds);
		return this.seconds;
	}
}
