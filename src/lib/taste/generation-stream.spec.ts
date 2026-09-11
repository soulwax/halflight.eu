import { describe, expect, it } from 'vitest';
import { readGenerationStream } from './generation-stream';

describe('readGenerationStream', () => {
	it('reassembles split frames and ignores malformed input', async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('data: {"type":"progress","sequence":0,"elapsedMs":'));
				controller.enqueue(encoder.encode('5,"stage":"expanding"}\n\ndata: nope\n\n'));
				controller.enqueue(
					encoder.encode(
						'data: {"type":"error","sequence":1,"elapsedMs":6,"errorCode":"generation_unavailable"}\n\n'
					)
				);
				controller.close();
			}
		});

		const events = [];
		for await (const event of readGenerationStream(new Response(stream))) events.push(event);

		expect(events).toEqual([
			{ type: 'progress', sequence: 0, elapsedMs: 5, stage: 'expanding' },
			{ type: 'error', sequence: 1, elapsedMs: 6, errorCode: 'generation_unavailable' }
		]);
	});
});
