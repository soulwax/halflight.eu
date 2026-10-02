import { error, type RequestHandler } from '@sveltejs/kit';
import { getTrackCoverId, tidalArtworkUrl } from '#lib/server/tidal';

const IMAGE_HEADERS = {
	accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
	'user-agent': 'TIDAL_ANDROID/1039 okhttp/3.13.1'
};

/**
 * Same-origin artwork proxy. It keeps both the TIDAL cover identifier and the
 * CDN address server-side while allowing ordinary `<img>` caching in the UI.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	const trackId = event.params.id;
	if (!trackId) error(400, 'Track ID required');
	const requestedSize = event.url.searchParams.get('size') ?? '640';
	if (!['80', '160', '320', '640'].includes(requestedSize)) error(400, 'Invalid artwork size');

	let coverId: string | null;
	try {
		coverId = await getTrackCoverId(trackId, {
			ctx: { fetch: event.fetch, cookies: event.cookies }
		});
	} catch {
		error(404, 'Artwork unavailable');
	}
	if (!coverId) error(404, 'Artwork unavailable');

	let upstream: Response;
	try {
		// The CDN rejects SvelteKit's request-context wrapper. Use global fetch,
		// as the audio proxy does, and never forward browser cookies or headers.
		upstream = await fetch(tidalArtworkUrl(coverId, `${requestedSize}x${requestedSize}`), {
			headers: IMAGE_HEADERS,
			redirect: 'follow'
		});
	} catch {
		error(502, 'Artwork CDN unreachable');
	}
	if (!upstream.ok) error(502, 'Artwork CDN unavailable');

	const contentType = upstream.headers.get('content-type');
	if (!contentType?.toLowerCase().startsWith('image/'))
		error(502, 'Artwork CDN returned invalid data');

	const headers = new Headers({
		'content-type': contentType,
		'cache-control': 'private, max-age=3600',
		'x-content-type-options': 'nosniff'
	});
	const contentLength = upstream.headers.get('content-length');
	if (contentLength) headers.set('content-length', contentLength);

	return new Response(upstream.body, { status: 200, headers });
};
