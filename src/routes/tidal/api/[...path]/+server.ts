import { error } from '@sveltejs/kit';
import { tidalFetch, TidalError, TidalNotConnectedError } from '#lib/server/tidal';
import type { RequestHandler } from './$types';

/**
 * Authenticated pass-through to the TIDAL API v2. The browser (or a future
 * feature) calls `/tidal/api/<path>?<query>`; this route injects the bearer
 * token server-side and relays TIDAL's response. Tokens never reach the client.
 *
 * Gated behind the Better Auth session. The host is fixed to the TIDAL API base
 * — only the path and query are caller-controlled.
 */
const handler: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Not authenticated');

	const path = event.params.path ?? '';
	const method = event.request.method;
	const hasBody = method !== 'GET' && method !== 'HEAD';

	const init: RequestInit = { method };
	if (hasBody) {
		init.body = await event.request.text();
		const contentType = event.request.headers.get('content-type');
		init.headers = { 'content-type': contentType ?? 'application/vnd.api+json' };
	}

	try {
		const response = await tidalFetch(`/${path}${event.url.search}`, init, { fetch: event.fetch });
		const body = await response.text();
		return new Response(body, {
			status: response.status,
			headers: {
				'content-type': response.headers.get('content-type') ?? 'application/json',
				'cache-control': 'no-store'
			}
		});
	} catch (err) {
		if (err instanceof TidalNotConnectedError) error(409, err.message);
		if (err instanceof TidalError) error(502, err.message);
		throw err;
	}
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
