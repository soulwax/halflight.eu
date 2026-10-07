/** Search the latest fresh input once per 3-second window; never poll an unchanged query. */
export const SEARCH_REFRESH_INTERVAL_MS = 3_000;

export class LiveSearchScheduler {
	private timer: ReturnType<typeof setTimeout> | undefined;
	private burstStartedAt: number | null = null;

	schedule(search: () => void): void {
		clearTimeout(this.timer);
		const now = Date.now();
		this.burstStartedAt ??= now;
		const delay = Math.max(0, SEARCH_REFRESH_INTERVAL_MS - (now - this.burstStartedAt));
		this.timer = setTimeout(() => {
			this.timer = undefined;
			this.burstStartedAt = null;
			search();
		}, delay);
	}

	cancel(preserveBurst = false): void {
		clearTimeout(this.timer);
		this.timer = undefined;
		if (!preserveBurst) this.burstStartedAt = null;
	}
}
