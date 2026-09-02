import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	fetchTrackStream,
	getConnectionStatus,
	tidalFetch,
	TidalApiError,
	type TrackAudioQuality
} from '#lib/server/tidal';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ error: 'not_connected' }, { status: 503 });
	}

	const trackId = event.params.id;
	if (!trackId) {
		error(400, 'Track ID required');
	}

	const requestedQuality = (event.url.searchParams.get('quality')?.toUpperCase() ||
		'HIGH') as TrackAudioQuality;
	const qualityTiers: TrackAudioQuality[] = Array.from(
		new Set([requestedQuality, 'HIGH', 'LOW', 'LOSSLESS'])
	);

	let lastError: unknown = null;

	// 1. Attempt full native track stream with r_usr credentials
	for (const quality of qualityTiers) {
		try {
			const streamInfo = await fetchTrackStream(trackId, {
				quality,
				ctx: {
					fetch: event.fetch,
					cookies: event.cookies
				}
			});

			return json({
				...streamInfo,
				isPreview: false,
				requiresFullAuth: false
			});
		} catch (err) {
			lastError = err;
			if (err instanceof TidalApiError && (err.status === 401 || err.status === 403)) {
				break;
			}
		}
	}

	// 2. Fallback to 30s preview URL so audio never fails to play while prompting user to link
	try {
		const previewRes = await tidalFetch(
			`https://api.tidal.com/v1/tracks/${encodeURIComponent(trackId)}/previewUrl`,
			{ headers: { accept: 'application/json' } },
			{ fetch: event.fetch, cookies: event.cookies }
		);

		if (previewRes.ok) {
			const previewData = (await previewRes.json()) as { url?: string };
			if (previewData.url) {
				return json({
					trackId: Number(trackId),
					streamUrl: previewData.url,
					urls: [previewData.url],
					fileExtension: '.m4a',
					mimeType: 'audio/mp4',
					codecs: 'mp4a.40.2',
					audioMode: 'STEREO',
					audioQuality: 'PREVIEW',
					isPreview: true,
					requiresFullAuth: true
				});
			}
		}
	} catch {
		// ignore preview fallback errors
	}

	if (
		lastError instanceof TidalApiError &&
		(lastError.status === 401 || lastError.status === 403)
	) {
		return json(
			{
				error: 'playback_unauthorized',
				message: lastError.message,
				requiresFullAuth: true
			},
			{ status: 403 }
		);
	}

	return json({ error: 'stream_unavailable' }, { status: 404 });
};
