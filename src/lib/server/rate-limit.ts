/**
 * Per-listener request budgets. Every listener shares one TIDAL developer app,
 * so a single runaway tab or script must not be able to spend the quota that
 * everyone else's browsing and playback depends on.
 *
 * Deliberately process-local, like the other hot-path caches: the self-hosted
 * deployment is one long-lived process, and a coarse budget that resets on
 * restart is enough to contain accidents and casual abuse. Fixed windows keep
 * it O(1) per request with a hard bound on memory.
 */

export interface RateLimitPolicy {
	/** Requests allowed per window. */
	limit: number;
	windowMs: number;
}

export interface RateLimitResult {
	allowed: boolean;
	retryAfterSeconds: number;
}

export interface RateLimiter {
	hit(key: string): RateLimitResult;
}

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter(
	policy: RateLimitPolicy,
	now: () => number = Date.now
): RateLimiter {
	const windows = new Map<string, { start: number; count: number }>();

	function sweep(at: number) {
		for (const [key, window] of windows) {
			if (at - window.start >= policy.windowMs) windows.delete(key);
		}
		// Still full of live windows: drop the oldest rather than grow without bound.
		while (windows.size >= MAX_TRACKED_KEYS) {
			const oldest = windows.keys().next().value;
			if (oldest === undefined) break;
			windows.delete(oldest);
		}
	}

	return {
		hit(key) {
			const at = now();
			let window = windows.get(key);
			if (!window || at - window.start >= policy.windowMs) {
				if (!window && windows.size >= MAX_TRACKED_KEYS) sweep(at);
				window = { start: at, count: 0 };
				windows.set(key, window);
			}
			window.count += 1;
			if (window.count <= policy.limit) return { allowed: true, retryAfterSeconds: 0 };
			return {
				allowed: false,
				retryAfterSeconds: Math.max(1, Math.ceil((window.start + policy.windowMs - at) / 1000))
			};
		}
	};
}

const MINUTE = 60_000;

type Bucket = 'audio' | 'upstream' | 'import' | 'generate' | 'api';

const POLICIES: Record<Bucket, RateLimitPolicy> = {
	// Range requests: every seek and buffer top-up is one.
	audio: { limit: 900, windowMs: MINUTE },
	// Each of these fans out to TIDAL on a cache miss.
	upstream: { limit: 120, windowMs: MINUTE },
	import: { limit: 6, windowMs: MINUTE },
	generate: { limit: 6, windowMs: MINUTE },
	api: { limit: 600, windowMs: MINUTE }
};

/** Which budget a request path draws from, or null when it is not limited. */
export function classifyRequest(pathname: string): Bucket | null {
	if (/^\/api\/tracks\/[^/]+\/audio\/?$/.test(pathname)) return 'audio';
	if (/^\/api\/taste\/generate\/?$/.test(pathname)) return 'generate';
	if (/^\/api\/playlists\/(import|sync)\/?$/.test(pathname)) return 'import';
	if (
		/^\/api\/(search|favorites)\/?$/.test(pathname) ||
		/^\/api\/tracks\/[^/]+\/(stream|radio)\/?$/.test(pathname)
	)
		return 'upstream';
	if (pathname.startsWith('/api/') || pathname.startsWith('/tidal/api/')) return 'api';
	return null;
}

export function createRequestLimiter(now?: () => number) {
	const limiters = Object.fromEntries(
		(Object.keys(POLICIES) as Bucket[]).map((bucket) => [
			bucket,
			createRateLimiter(POLICIES[bucket], now)
		])
	) as Record<Bucket, RateLimiter>;

	return {
		/** Counts one request by `userId`; `allowed: true` for paths that are not limited. */
		check(userId: string, pathname: string): RateLimitResult {
			const bucket = classifyRequest(pathname);
			if (!bucket) return { allowed: true, retryAfterSeconds: 0 };
			return limiters[bucket].hit(userId);
		}
	};
}

export const requestLimiter = createRequestLimiter();
