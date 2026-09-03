import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getStreamingSettings } from '#lib/server/streaming-settings';
import { createDownloadJob, type StreamripOutputFormat } from '#lib/server/streamrip-jobs';
import {
	WorkerAuthenticationError,
	WorkerConfigError,
	WorkerUnavailableError
} from '#lib/server/worker';

const OUTPUT_FORMATS = new Set<StreamripOutputFormat>(['source', 'flac', 'aac', 'mp3', 'opus']);

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	const body = (await event.request.json().catch(() => null)) as {
		trackId?: unknown;
		outputFormat?: unknown;
	} | null;
	const trackId = typeof body?.trackId === 'string' ? body.trackId.trim() : '';
	const outputFormat =
		typeof body?.outputFormat === 'string' &&
		OUTPUT_FORMATS.has(body.outputFormat as StreamripOutputFormat)
			? (body.outputFormat as StreamripOutputFormat)
			: 'source';
	if (!trackId || trackId.length > 128) error(400, 'A valid track ID is required');

	try {
		const settings = await getStreamingSettings(event.locals.user.id);
		const job = await createDownloadJob(
			event.locals.user.id,
			trackId,
			settings.preferredQuality,
			outputFormat,
			event.fetch
		);
		return json({ id: job.id, status: 'queued' }, { status: 202 });
	} catch (cause) {
		if (
			cause instanceof WorkerConfigError ||
			cause instanceof WorkerUnavailableError ||
			cause instanceof WorkerAuthenticationError
		) {
			return json({ error: 'worker_unavailable' }, { status: 503 });
		}
		return json({ error: 'download_unavailable' }, { status: 502 });
	}
};
