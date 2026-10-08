export interface ImportResult {
	tidalPlaylistId: string;
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
