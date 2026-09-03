import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	getConnectionStatus,
	resolveTrackStream,
	TidalApiError,
	TidalAuthError,
	TidalPlaybackNotLinkedError,
	TidalQualityDeniedError,
	type TrackAudioQuality
} from '#lib/server/tidal';
import { getStreamingSettings, isStreamingQuality } from '#lib/server/streaming-settings';

/**
 * The quality to start the ladder at: an explicit `?quality=` wins, otherwise the
 * signed-in owner's saved preference, otherwise the ladder's own default.
 */
async function startQuality(event: {
	url: URL;
	locals: App.Locals;
}): Promise<TrackAudioQuality | undefined> {
	const explicit = event.url.searchParams.get('quality')?.toUpperCase();
	if (explicit && isStreamingQuality(explicit)) return explicit;
	if (!event.locals.user) return undefined;
	try {
		return (await getStreamingSettings(event.locals.user.id)).preferredQuality;
	} catch {
		return undefined;
	}
}

function isAuthProblem(err: unknown): boolean {
	return (
		err instanceof TidalPlaybackNotLinkedError ||
		err instanceof TidalAuthError ||
		(err instanceof TidalApiError && (err.status === 401 || err.status === 403))
	);
}

/** A short, loggable reason for a playback failure. */
function describe(err: unknown): string {
	if (err instanceof TidalPlaybackNotLinkedError) return 'not_linked';
	if (err instanceof TidalAuthError) return 'device_refresh_rejected';
	if (err instanceof TidalQualityDeniedError)
		return `plan_no_streaming (${err.triedQualities.join(',')})`;
	if (err instanceof TidalApiError) {
		const body = err.body as { subStatus?: number; userMessage?: string } | null;
		return `tidal_${err.status}${body?.subStatus ? `_${body.subStatus}` : ''}: ${
			body?.userMessage ?? err.statusText
		}`;
	}
	return err instanceof Error ? err.message : 'unknown';
}

/**
 * GET /api/tracks/[id]/stream
 *
 * Returns full playback metadata (stream URL, quality, codecs, ReplayGain) for a
 * track, walking down the quality ladder to whatever the account's plan allows.
 * A 403 with `requiresFullAuth: true` means the player should prompt for a TIDAL
 * Link; `reason: "plan_no_streaming"` means the plan has no streaming at all.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const status = await getConnectionStatus();
	if (!status.configured) {
		return json({ error: 'not_connected' }, { status: 503 });
	}
	if (!status.hasPlayback) {
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

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	try {
		const streamInfo = await resolveTrackStream(trackId, {
			quality: await startQuality(event),
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
		return json({ ...streamInfo, isPreview: false, requiresFullAuth: false });
	} catch (err) {
		const reason = describe(err);
		console.error(`[tidal] stream ${trackId} failed: ${reason}`);

		if (err instanceof TidalQualityDeniedError) {
			return json(
				{
					error: 'plan_no_streaming',
					reason,
					message: err.message,
					requiresFullAuth: false
				},
				{ status: 403 }
			);
		}
		if (isAuthProblem(err)) {
			return json(
				{
					error: 'playback_unauthorized',
					reason,
					message: err instanceof Error ? err.message : 'Full playback authorization required.',
					requiresFullAuth: true
				},
				{ status: 403 }
			);
		}
		return json({ error: 'stream_unavailable', reason }, { status: 404 });
	}
};
