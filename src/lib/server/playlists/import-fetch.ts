import { log } from '#lib/server/log';

interface Lane {
	tail: Promise<void>;
	nextAt: number;
	interval: number;
	successes: number;
}
const lanes = new Map<string, Lane>();
const MAX_RATE_LIMIT_RETRIES = 6;
const MAX_COOLDOWN_MS = 120_000;
function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
	signal?.throwIfAborted();
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const abort = () => {
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			reject(signal?.reason);
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', abort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', abort, { once: true });
	});
}
export function retryAfterMs(value: string | null, now = Date.now()): number {
	if (value !== null && value.trim()) {
		const seconds = Number(value);
		if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1_000, seconds * 1_000);
		const date = Date.parse(value);
		if (Number.isFinite(date)) return Math.max(1_000, date - now);
	}
	return 30_000;
}
/** All import reads share a paced lane per provider host, not just audio probes. */
export function createImportFetch(fetchImpl: typeof fetch): typeof fetch {
	return async (input, init = {}) => {
		const url = new URL(
			typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		);
		if (!['openapi.tidal.com', 'api.tidal.com', 'auth.tidal.com'].includes(url.hostname))
			return fetchImpl(input, init);
		const baseInterval = url.hostname === 'api.tidal.com' ? 1_500 : 1_000;
		let lane = lanes.get(url.hostname);
		if (!lane) {
			lane = { tail: Promise.resolve(), nextAt: 0, interval: baseInterval, successes: 0 };
			lanes.set(url.hostname, lane);
		}
		const active = lane;
		const signal = init.signal ?? (input instanceof Request ? input.signal : undefined);
		const previous = active.tail;
		let release!: () => void;
		active.tail = new Promise<void>((resolve) => {
			release = resolve;
		});
		try {
			await previous;
			for (let attempt = 0; ; attempt++) {
				signal?.throwIfAborted();
				const delay = Math.max(0, active.nextAt - Date.now());
				if (delay > MAX_COOLDOWN_MS) throw new Error('TIDAL import cooldown exceeds wait budget');
				await wait(delay, signal);
				const timeout = AbortSignal.timeout(25_000);
				active.nextAt = Date.now() + active.interval;
				const response = await fetchImpl(input, {
					...init,
					signal: signal ? AbortSignal.any([signal, timeout]) : timeout
				});
				if (response.status !== 429) {
					if (response.ok && ++active.successes >= 20) {
						active.interval = Math.max(baseInterval, active.interval * 0.9);
						active.successes = 0;
					}
					return response;
				}
				active.successes = 0;
				active.interval = Math.min(10_000, active.interval * 1.5);
				const cooldown = retryAfterMs(response.headers.get('retry-after'));
				active.nextAt = Math.max(active.nextAt, Date.now() + cooldown);
				log.info('TIDAL import waiting after rate limit', {
					host: url.hostname,
					cooldownSeconds: Math.ceil(cooldown / 1000),
					attempt: attempt + 1
				});
				if (attempt >= MAX_RATE_LIMIT_RETRIES || cooldown > MAX_COOLDOWN_MS) return response;
				await response.body?.cancel().catch(() => {});
			}
		} finally {
			release();
		}
	};
}
export function resetImportFetch(): void {
	lanes.clear();
}
