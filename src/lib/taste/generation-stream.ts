import { isGenerationStreamEvent, type GenerationStreamEvent } from './generation-progress.js';

/**
 * Read the small SSE dialect used by the generation endpoint. Invalid frames
 * are ignored so a truncated intermediary response cannot replace a valid
 * provisional set in the caller.
 */
export async function* readGenerationStream(
	response: Pick<Response, 'body'>
): AsyncGenerator<GenerationStreamEvent> {
	if (!response.body) return;

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let pending = '';

	const takeEvents = (source: string): { events: GenerationStreamEvent[]; remaining: string } => {
		const events: GenerationStreamEvent[] = [];
		let remaining = source;
		let boundary = remaining.indexOf('\n\n');
		while (boundary !== -1) {
			const block = remaining.slice(0, boundary);
			remaining = remaining.slice(boundary + 2);
			boundary = remaining.indexOf('\n\n');
			const data = block
				.split('\n')
				.find((line) => line.startsWith('data: '))
				?.slice(6);
			if (!data) continue;
			try {
				const event: unknown = JSON.parse(data);
				if (isGenerationStreamEvent(event)) events.push(event);
			} catch {
				// Ignore an invalid SSE frame and wait for a future valid event.
			}
		}
		return { events, remaining };
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		pending += decoder.decode(value, { stream: true });
		const parsed = takeEvents(pending);
		pending = parsed.remaining;
		for (const event of parsed.events) yield event;
	}

	pending += decoder.decode();
	for (const event of takeEvents(pending).events) yield event;
}
