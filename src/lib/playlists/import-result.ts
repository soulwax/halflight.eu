import type { TrackSummary } from '#lib/tidal/models';
export interface ImportResult {
	tidalPlaylistId: string;
	playlistId?: string;
	unmatchedTracks?: TrackSummary[];
	status: 'created' | 'synced' | 'error' | 'conflict';
	tracksSkipped: number;
	tracksReplaced: number;
	tracksBestFit: number;
	errorCode?: string;
}
/** Never infer successful playback verification from aggregate counters alone. */
export function readImportResult(value: unknown, requestedId: string): ImportResult {
	if (!value || typeof value !== 'object') throw new Error('Invalid import response');
	const results = (value as { imported?: unknown }).imported;
	if (!Array.isArray(results) || results.length !== 1)
		throw new Error('Incomplete import response');
	const result = results[0];
	if (
		!result ||
		result.tidalPlaylistId !== requestedId ||
		!['created', 'synced', 'error', 'conflict'].includes(result.status)
	)
		throw new Error('Mismatched import response');
	const successful = result.status === 'created' || result.status === 'synced';
	if (successful && result.streamValidation !== 'verified') throw new Error('Unverified import');
	const count = (number: unknown) => {
		if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0 || number > 5000)
			throw new Error('Invalid import counts');
		return number;
	};
	const skipped = count(result.tracksSkipped ?? (successful ? undefined : 0));
	const replaced = count(result.tracksReplaced ?? (successful ? undefined : 0));
	const bestFits = count(result.tracksBestFit ?? 0);
	if (bestFits > replaced) throw new Error('Invalid replacement counts');
	return {
		tidalPlaylistId: requestedId,
		playlistId: typeof result.playlistId === 'string' ? result.playlistId : undefined,
		unmatchedTracks: Array.isArray(result.unmatchedTracks)
			? result.unmatchedTracks.filter(
					(track: TrackSummary) =>
						track?.kind === 'track' &&
						typeof track.id === 'string' &&
						typeof track.title === 'string' &&
						Array.isArray(track.artists)
				)
			: [],
		status: result.status,
		tracksSkipped: skipped,
		tracksReplaced: replaced,
		tracksBestFit: bestFits,
		errorCode: typeof result.errorCode === 'string' ? result.errorCode : undefined
	};
}

/** Heartbeats keep long imports alive; a stalled connection must still be retryable. */
export async function readImportResponse(
	response: Response,
	signal: AbortSignal
): Promise<unknown> {
	if (!response.body) throw new Error('Missing import response');
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let text = '';
	let completed = false;
	const abort = () => {
		void reader.cancel().catch(() => {});
	};
	signal.addEventListener('abort', abort, { once: true });
	try {
		while (true) {
			signal.throwIfAborted();
			let timer: ReturnType<typeof setTimeout> | undefined;
			const timeout = new Promise<never>((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error('Import connection stalled')), 45_000);
			});
			let chunk: ReadableStreamReadResult<Uint8Array>;
			try {
				chunk = await Promise.race([reader.read(), timeout]);
			} finally {
				clearTimeout(timer);
			}
			signal.throwIfAborted();
			if (chunk.done) {
				text += decoder.decode();
				completed = true;
				break;
			}
			text += decoder.decode(chunk.value, { stream: true });
			if (text.length > 1_000_000) throw new Error('Import response exceeded limit');
		}
		return JSON.parse(text);
	} finally {
		signal.removeEventListener('abort', abort);
		if (!completed) void reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

const MAX_THROTTLED_ATTEMPTS = 5;
const MAX_THROTTLE_WAIT_SECONDS = 120;

/**
 * Imports share a small per-listener request budget. A throttled request has not
 * started any work, so it is waited out and re-sent rather than reported as a
 * failed playlist. `onWait` receives the pause in seconds (0 when it ends).
 */
export async function fetchWithinImportBudget(
	send: () => Promise<Response>,
	signal: AbortSignal,
	onWait: (seconds: number) => void = () => {}
): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		const response = await send();
		if (response.status !== 429 || attempt >= MAX_THROTTLED_ATTEMPTS) return response;
		const header = Number(response.headers.get('retry-after'));
		const seconds = Number.isFinite(header) && header > 0 ? Math.ceil(header) : 10;
		if (seconds > MAX_THROTTLE_WAIT_SECONDS) return response;
		await response.body?.cancel().catch(() => {});
		onWait(seconds);
		try {
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(done, seconds * 1000);
				function done() {
					signal.removeEventListener('abort', abort);
					resolve();
				}
				function abort() {
					clearTimeout(timer);
					reject(signal.reason);
				}
				signal.throwIfAborted();
				signal.addEventListener('abort', abort, { once: true });
			});
		} finally {
			onWait(0);
		}
	}
}
