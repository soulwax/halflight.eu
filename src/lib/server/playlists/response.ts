/**
 * Playback checks can outlast a reverse proxy's idle timeout. JSON whitespace
 * keeps the response active while the client waits for the completed result;
 * no partial result is treated as a successful import.
 */
export function playlistWorkResponse(work: () => Promise<unknown>): Response {
	const encoder = new TextEncoder();
	let cancelled = false;
	let heartbeat: ReturnType<typeof setInterval>;
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode('\n'));
			heartbeat = setInterval(() => controller.enqueue(encoder.encode('\n')), 15_000);
			void Promise.resolve()
				.then(work)
				.then((result) => {
					if (cancelled) return;
					controller.enqueue(encoder.encode(JSON.stringify(result)));
					controller.close();
				})
				.catch(() => {
					if (!cancelled) controller.error(new Error('Playlist operation failed'));
				})
				.finally(() => clearInterval(heartbeat));
		},
		cancel() {
			cancelled = true;
			clearInterval(heartbeat);
		}
	});
	return new Response(body, {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Accel-Buffering': 'no'
		}
	});
}
