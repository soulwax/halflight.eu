/**
 * Transient-failure retry for safe (idempotent) TIDAL reads.
 *
 * This lived inside `tidalFetch`, which meant the JSON:API browse surface was
 * the only thing protected by it. The two calls that sit directly in the
 * playback hot path — `playbackinfopostpaywall` and the CDN media/segment
 * fetches — had no retry at all, so a single transient 502 killed a play
 * outright, and for a segmented HiRes track it discarded an
 * already-mostly-downloaded concatenation.
 */

/** Upstream statuses worth a second attempt on a safe read. */
export const TRANSIENT_READ_STATUSES = new Set([408, 500, 502, 503, 504]);

export const MAX_TRANSIENT_READ_RETRIES = 2;

const INITIAL_RETRY_DELAY_MS = 100;

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
}

function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
	if (signal?.aborted) return Promise.reject(abortReason(signal));
	return new Promise((resolve, reject) => {
		const timer = setTimeout(done, ms);
		function done(): void {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}
		function onAbort(): void {
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			reject(
				signal ? abortReason(signal) : new DOMException('The request was aborted.', 'AbortError')
			);
		}
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

export interface TransientRetryOptions {
	/** Attempts after the first. Pass `0` to disable (e.g. for unsafe methods). */
	retries?: number;
	/** Caller's abort signal — an aborted request is never retried. */
	signal?: AbortSignal | null;
}

/**
 * Run `send` until it yields a non-transient response, retrying with exponential
 * backoff (100ms, 200ms, …). Only ever wrap idempotent requests: a retry re-sends
 * the whole thing.
 */
export async function withTransientRetry(
	send: () => Promise<Response>,
	options: TransientRetryOptions = {}
): Promise<Response> {
	const retries = options.retries ?? MAX_TRANSIENT_READ_RETRIES;

	for (let attempt = 0; ; attempt += 1) {
		if (options.signal?.aborted) throw abortReason(options.signal);
		try {
			const response = await send();
			if (!TRANSIENT_READ_STATUSES.has(response.status) || attempt === retries) {
				return response;
			}
			// Release the socket: this body is being discarded for a retry.
			await response.body?.cancel().catch(() => undefined);
		} catch (reason) {
			if (
				attempt === retries ||
				options.signal?.aborted ||
				(reason instanceof DOMException && reason.name === 'AbortError')
			) {
				throw reason;
			}
		}

		await wait(INITIAL_RETRY_DELAY_MS * 2 ** attempt, options.signal);
	}
}
