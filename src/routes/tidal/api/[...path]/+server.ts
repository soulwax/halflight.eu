import { tidalFetch, TidalError, TidalNotConnectedError } from '#lib/server/tidal';
import type { RequestHandler } from './$types';

/**
 * Read-only authenticated pass-through to the TIDAL API v2. The browser (or a
 * future feature) calls `/tidal/api/<path>?<query>`; this route injects the
 * bearer token server-side and relays TIDAL's response. Tokens never reach the
 * client and browser callers cannot mutate TIDAL data through this route.
 *
 * Gated behind the Better Auth session. The host is fixed to the TIDAL API base
 * — only the path and query are caller-controlled.
 */
const SECURITY_HEADERS = {
	'cache-control': 'private, no-store, max-age=0',
	'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
	'cross-origin-resource-policy': 'same-origin',
	'referrer-policy': 'no-referrer',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY'
};

function responseHeaders(headers: HeadersInit = {}): Headers {
	return new Headers({ ...SECURITY_HEADERS, ...headers });
}

function safeErrorResponse(status: number, message: string): Response {
	return new Response(JSON.stringify({ message }), {
		status,
		headers: responseHeaders({ 'content-type': 'application/json; charset=utf-8' })
	});
}

const handler: RequestHandler = async (event) => {
	if (!event.locals.user) return safeErrorResponse(401, 'Not authenticated.');

	const path = event.params.path ?? '';
	const method = event.request.method;

	try {
		const response = await tidalFetch(
			`/${path}${event.url.search}`,
			{ method },
			{ fetch: event.fetch }
		);
		const body = method === 'HEAD' ? null : await response.text();
		return new Response(body, {
			status: response.status,
			headers: responseHeaders({
				'content-type': response.headers.get('content-type') ?? 'application/json'
			})
		});
	} catch (err) {
		if (err instanceof TidalNotConnectedError) {
			return safeErrorResponse(409, 'TIDAL is not connected. Connect an account first.');
		}
		if (err instanceof TidalError) {
			return safeErrorResponse(502, 'TIDAL is temporarily unavailable. Please try again later.');
		}
		throw err;
	}
};

const methodNotAllowed: RequestHandler = () =>
	new Response(null, {
		status: 405,
		headers: responseHeaders({ allow: 'GET, HEAD' })
	});

export const GET = handler;
export const HEAD = handler;
export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
