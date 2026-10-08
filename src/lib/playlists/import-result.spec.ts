import { afterEach, describe, expect, it, vi } from 'vitest';
import { readImportResponse, readImportResult } from './import-result';
const result = {
	tidalPlaylistId: 'remote',
	status: 'created',
	streamValidation: 'verified',
	tracksSkipped: 1,
	tracksReplaced: 2,
	tracksBestFit: 1
};
afterEach(() => vi.useRealTimers());
describe('verified import response', () => {
	it('accepts only the requested playlist with verified playback and honest counts', () => {
		expect(readImportResult({ imported: [result] }, 'remote')).toMatchObject({
			status: 'created',
			tracksBestFit: 1
		});
	});
	it.each([
		{ totalImported: 1 },
		{ imported: [] },
		{ imported: [result, result] },
		{ imported: [{ ...result, tidalPlaylistId: 'another' }] },
		{ imported: [{ ...result, streamValidation: 'deferred' }] },
		{ imported: [{ ...result, tracksSkipped: -1 }] },
		{ imported: [{ ...result, tracksBestFit: 3 }] }
	])('never claims success from a partial, mismatched or unverified response', (body) => {
		expect(() => readImportResult(body, 'remote')).toThrow();
	});
	it('reads heartbeat whitespace and waits for the final JSON', async () => {
		const response = new Response(
			new ReadableStream({
				start(controller) {
					const encoder = new TextEncoder();
					controller.enqueue(encoder.encode('\n'));
					controller.enqueue(encoder.encode(JSON.stringify({ imported: [result] })));
					controller.close();
				}
			})
		);
		expect(await readImportResponse(response, new AbortController().signal)).toEqual({
			imported: [result]
		});
	});
	it('makes stalled connections retryable and cancels the reader', async () => {
		vi.useFakeTimers();
		const cancel = vi.fn();
		const response = new Response(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('\n'));
				},
				cancel
			})
		);
		const pending = readImportResponse(response, new AbortController().signal);
		const assertion = expect(pending).rejects.toThrow('stalled');
		await vi.advanceTimersByTimeAsync(45_001);
		await assertion;
		expect(cancel).toHaveBeenCalledOnce();
	});
	it('does not accept truncated JSON after navigation aborts an import', async () => {
		const controller = new AbortController();
		const response = new Response(
			new ReadableStream({
				start(stream) {
					stream.enqueue(new TextEncoder().encode('{"imported":'));
				}
			})
		);
		const pending = readImportResponse(response, controller.signal);
		const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		controller.abort();
		await assertion;
	});
});
