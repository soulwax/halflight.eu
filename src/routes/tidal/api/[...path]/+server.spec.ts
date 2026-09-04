import { beforeEach, describe, expect, it, vi } from 'vitest';

const tidal = vi.hoisted(() => {
	class TidalError extends Error {}
	class TidalNotConnectedError extends TidalError {}

	return {
		tidalFetch: vi.fn(),
		TidalError,
		TidalNotConnectedError
	};
});

vi.mock('#lib/server/tidal', () => tidal);

import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from './+server';

function eventFor(
	method: string,
	{
		user = true,
		isAdministrator = user,
		path = 'users/me',
		query = ''
	}: { user?: boolean; isAdministrator?: boolean; path?: string; query?: string } = {}
) {
	const fetch = vi.fn();
	return {
		locals: { user: user ? { id: 'user-1' } : undefined, isAdministrator },
		params: { path },
		url: new URL(`https://syn.bluesix.dev/tidal/api/${path}${query}`),
		request: new Request(`https://syn.bluesix.dev/tidal/api/${path}${query}`, { method }),
		fetch
	};
}

describe('/tidal/api/[...path]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('proxies authenticated GET diagnostics without forwarding a request body', async () => {
		const event = eventFor('GET', { query: '?countryCode=DE' });
		tidal.tidalFetch.mockResolvedValue(
			new Response('{"data":[]}', {
				status: 200,
				headers: { 'content-type': 'application/vnd.api+json' }
			})
		);

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);

		expect(tidal.tidalFetch).toHaveBeenCalledWith(
			'/users/me?countryCode=DE',
			{ method: 'GET' },
			{ fetch: event.fetch }
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/vnd.api+json');
		expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await response.text()).toBe('{"data":[]}');
	});

	it('does not call TIDAL for an unauthenticated request', async () => {
		const event = eventFor('GET', { user: false });

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);

		expect(tidal.tidalFetch).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
		expect(await response.json()).toEqual({ message: 'Not authenticated.' });
	});

	it('allows a signed-in non-administrator to use their own TIDAL connection', async () => {
		const event = eventFor('GET', { isAdministrator: false });
		tidal.tidalFetch.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);

		expect(tidal.tidalFetch).toHaveBeenCalledOnce();
		expect(response.status).toBe(200);
	});

	it('returns a safe reconnect response when no TIDAL account is connected', async () => {
		const event = eventFor('GET');
		tidal.tidalFetch.mockRejectedValue(new tidal.TidalNotConnectedError('token record: sensitive'));

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(409);
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
		expect(await response.json()).toEqual({
			message: 'TIDAL is not connected. Connect an account first.'
		});
	});

	it('does not expose TIDAL error details', async () => {
		const event = eventFor('GET');
		tidal.tidalFetch.mockRejectedValue(new tidal.TidalError('upstream token detail'));

		const response = await GET(event as unknown as Parameters<typeof GET>[0]);

		expect(response.status).toBe(502);
		expect(await response.text()).not.toContain('upstream token detail');
	});

	it.each([
		['POST', POST],
		['PATCH', PATCH],
		['PUT', PUT],
		['DELETE', DELETE],
		['OPTIONS', OPTIONS]
	])('rejects %s before it can reach TIDAL', async (_method, handler) => {
		const event = eventFor(_method);

		const response = await handler(event as unknown as Parameters<typeof handler>[0]);

		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET, HEAD');
		expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
		expect(tidal.tidalFetch).not.toHaveBeenCalled();
	});

	it('forwards authenticated HEAD requests without sending a response body', async () => {
		const event = eventFor('HEAD');
		tidal.tidalFetch.mockResolvedValue(new Response(null, { status: 200 }));

		const response = await HEAD(event as unknown as Parameters<typeof HEAD>[0]);

		expect(tidal.tidalFetch).toHaveBeenCalledWith(
			'/users/me',
			{ method: 'HEAD' },
			{ fetch: event.fetch }
		);
		expect(await response.text()).toBe('');
	});
});
