import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getConnectionStatus, tidalFetch } from '#lib/server/tidal';

interface StreamResult {
	streamUrl: string;
	mimeType: string;
	audioMode?: string;
	bitDepth?: number;
	sampleRate?: number;
}

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

	// Query TIDAL API v1 playbackinfopostpaywall across quality levels (HIGH -> LOW -> LOSSLESS)
	// Similar to tiddl under the hood to get the direct unencrypted audio stream
	const qualities = ['HIGH', 'LOW', 'LOSSLESS'];

	for (const quality of qualities) {
		try {
			const targetUrl = `https://api.tidal.com/v1/tracks/${encodeURIComponent(trackId)}/playbackinfopostpaywall?audioquality=${quality}&playbackmode=STREAM&assetpresentation=FULL`;
			const response = await tidalFetch(
				targetUrl,
				{
					headers: {
						accept: 'application/json, text/plain, */*'
					}
				},
				{
					fetch: event.fetch,
					cookies: event.cookies
				}
			);

			if (!response.ok) {
				continue;
			}

			const data = (await response.json()) as {
				manifest?: string;
				manifestMimeType?: string;
				audioMode?: string;
				bitDepth?: number;
				sampleRate?: number;
			};

			if (data.manifest && data.manifestMimeType === 'application/vnd.tidal.bts') {
				const decoded = JSON.parse(Buffer.from(data.manifest, 'base64').toString('utf-8')) as {
					mimeType?: string;
					urls?: string[];
				};

				if (decoded.urls && decoded.urls.length > 0) {
					const result: StreamResult = {
						streamUrl: decoded.urls[0],
						mimeType: decoded.mimeType || 'audio/mp4',
						audioMode: data.audioMode || quality,
						bitDepth: data.bitDepth,
						sampleRate: data.sampleRate
					};
					return json(result);
				}
			}
		} catch {
			// Attempt next quality tier
		}
	}

	// Optional fallback: track preview URL
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
					streamUrl: previewData.url,
					mimeType: 'audio/mp4',
					audioMode: 'PREVIEW'
				});
			}
		}
	} catch {
		// ignore
	}

	return json({ error: 'stream_unavailable' }, { status: 404 });
};
