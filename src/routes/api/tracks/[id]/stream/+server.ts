import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import { getStreamingSettings, isStreamingQuality } from '#lib/server/streaming-settings';
import { createPlaybackJob } from '#lib/server/streamrip-jobs';
import {
	WorkerAuthenticationError,
	WorkerConfigError,
	WorkerUnavailableError,
	type WorkerAudioQuality
} from '#lib/server/worker';

async function requestedQuality(event: {
	url: URL;
	locals: App.Locals;
}): Promise<Extract<WorkerAudioQuality, 'LOW' | 'HIGH' | 'LOSSLESS'>> {
	const explicit = event.url.searchParams.get('quality')?.toUpperCase();
	if (explicit && isStreamingQuality(explicit)) return explicit;
	return (await getStreamingSettings(event.locals.user!.id)).preferredQuality;
}

/**
 * Starts worker-owned playback. Syn returns a short-lived opaque worker URL and
 * never proxies the audio/CDN response through Vercel.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');

	const connection = await getConnectionStatus();
	if (!connection.configured) return json({ error: 'not_connected' }, { status: 503 });
	if (!connection.hasPlayback) {
		return json(
			{
				error: 'playback_unauthorized',
				reason: 'not_linked',
				message: 'Full playback is not linked. Authorize playback via TIDAL Link in settings.',
				requiresFullAuth: true
			},
			{ status: 403 }
		);
	}

	try {
		const settings = await getStreamingSettings(event.locals.user.id);
		const result = await createPlaybackJob(
			event.locals.user.id,
			trackId,
			await requestedQuality(event),
			settings.loudnessNormalization,
			event.fetch
		);
		return json({
			streamUrl: result.session.playbackUrl,
			jobId: result.jobId,
			audioQuality: result.session.audioQuality,
			mimeType: result.session.mimeType,
			fileExtension: result.session.fileExtension,
			expiresAt: result.session.expiresAt,
			isPreview: false,
			requiresFullAuth: false
		});
	} catch (cause) {
		if (cause instanceof WorkerConfigError || cause instanceof WorkerUnavailableError) {
			return json({ error: 'worker_unavailable', requiresFullAuth: false }, { status: 503 });
		}
		if (cause instanceof WorkerAuthenticationError) {
			return json({ error: 'worker_misconfigured', requiresFullAuth: false }, { status: 503 });
		}
		return json({ error: 'stream_unavailable', requiresFullAuth: false }, { status: 404 });
	}
};
