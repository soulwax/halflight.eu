import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getGenerationCooldownTrackIds } from '#lib/server/taste/cooldown';
import {
	generateTasteSet,
	type GenerationProgress,
	type ProvisionalSet
} from '#lib/server/taste/generate';
import { parseGenerateTasteSetInput } from '#lib/server/taste/generate-input';
import { createLiveGraphClient } from '#lib/server/taste/graph';
import { getTasteProfile } from '#lib/server/taste/profile';
import { getConnectionStatus } from '#lib/server/tidal';
import type { GenerationStreamEvent } from '#lib/taste/generation-progress';

const encoder = new TextEncoder();

function encodeEvent(event: GenerationStreamEvent): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Progressive generation endpoint. The ordinary form actions remain the
 * no-JavaScript fallback; enhanced clients use this stream for truthful stage
 * updates and can abort the request to cancel upstream graph reads.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ errorCode: 'generation_connection_required' }, { status: 409 });
	}

	const input = parseGenerateTasteSetInput(await event.request.formData());
	if (!input.success) return json({ errorCode: 'invalid_generation_input' }, { status: 400 });

	const userId = event.locals.user.id;
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const startedAt = Date.now();
			let sequence = 0;
			let closed = false;
			const eventMetadata = () => ({ sequence: sequence++, elapsedMs: Date.now() - startedAt });
			const emitProgress = (progress: GenerationProgress) => {
				if (closed || event.request.signal.aborted) return;
				controller.enqueue(encodeEvent({ type: 'progress', ...eventMetadata(), ...progress }));
			};
			const emitComplete = (set: ProvisionalSet) => {
				if (closed || event.request.signal.aborted) return;
				controller.enqueue(encodeEvent({ type: 'complete', ...eventMetadata(), set }));
			};
			const emitError = () => {
				if (closed || event.request.signal.aborted) return;
				controller.enqueue(
					encodeEvent({ type: 'error', ...eventMetadata(), errorCode: 'generation_unavailable' })
				);
			};
			const finish = () => {
				if (closed) return;
				closed = true;
				controller.close();
			};

			try {
				const [profile, cooldownTrackIds] = await Promise.all([
					getTasteProfile(userId),
					getGenerationCooldownTrackIds(userId)
				]);
				if (event.request.signal.aborted) return finish();
				const progress = (update: GenerationProgress) => {
					emitProgress(update);
				};
				const set: ProvisionalSet = await generateTasteSet(profile, {
					knobs: input.output,
					cooldownTrackIds,
					client: createLiveGraphClient({
						fetch: event.fetch,
						cookies: event.cookies,
						signal: event.request.signal
					}),
					signal: event.request.signal,
					onProgress: progress
				});
				if (!event.request.signal.aborted) emitComplete(set);
			} catch {
				if (!event.request.signal.aborted) emitError();
			} finally {
				finish();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'cache-control': 'private, no-store',
			'content-type': 'text/event-stream; charset=utf-8',
			'x-accel-buffering': 'no'
		}
	});
};
