import { describe, expect, it, vi } from 'vitest';
import { loadTidalPage } from './load';
import { TidalApiError, TidalAuthError, TidalNotConnectedError } from './errors';

type Fail = { data: null; state: string; configured: boolean; id?: string };
const failure = (state: string, configured: boolean, id?: string): Fail => ({
	data: null,
	state,
	configured,
	id
});

function event({ id, noUser = false }: { id?: string; noUser?: boolean }) {
	return {
		locals: { user: noUser ? undefined : { id: 'u1' } },
		params: { id },
		fetch: vi.fn(),
		cookies: {}
	} as unknown as Parameters<typeof loadTidalPage>[0];
}

const connected = () => Promise.resolve({ connected: true, configured: true });
const ok = async () => failure('ok', true);

describe('loadTidalPage', () => {
	it('redirects to sign-in when there is no session', async () => {
		const result = loadTidalPage(event({ id: 'res-1', noUser: true }), {
			getConnectionStatus: connected,
			failure,
			run: ok
		});
		await expect(result).rejects.toMatchObject({ status: 302, location: '/sign-in' });
	});

	it('rejects a missing or overlong id before touching the connection', async () => {
		const getConnectionStatus = vi.fn(connected);

		await expect(
			loadTidalPage(event({ id: undefined }), { getConnectionStatus, failure, run: ok })
		).resolves.toEqual({ data: null, state: 'invalid_id', configured: true, id: undefined });

		await expect(
			loadTidalPage(event({ id: 'x'.repeat(161) }), { getConnectionStatus, failure, run: ok })
		).resolves.toMatchObject({ state: 'invalid_id' });

		expect(getConnectionStatus).not.toHaveBeenCalled();
	});

	it('maps a connection-status failure to unavailable', async () => {
		await expect(
			loadTidalPage(event({ id: 'res-1' }), {
				getConnectionStatus: () => Promise.reject(new Error('db down')),
				failure,
				run: ok
			})
		).resolves.toEqual({ data: null, state: 'unavailable', configured: true, id: 'res-1' });
	});

	it('short-circuits to not_connected without running when disconnected', async () => {
		const run = vi.fn();
		await expect(
			loadTidalPage(event({ id: 'res-1' }), {
				getConnectionStatus: () => Promise.resolve({ connected: false, configured: false }),
				failure,
				run
			})
		).resolves.toEqual({ data: null, state: 'not_connected', configured: false, id: 'res-1' });
		expect(run).not.toHaveBeenCalled();
	});

	it('passes the request context and id into run and returns its value', async () => {
		const run = vi.fn(async (_ctx: unknown, id: string, configured: boolean) => ({
			data: { id },
			state: null,
			configured
		}));

		await expect(
			loadTidalPage(event({ id: 'res-9' }), { getConnectionStatus: connected, failure, run })
		).resolves.toEqual({ data: { id: 'res-9' }, state: null, configured: true });
		expect(run).toHaveBeenCalledWith(
			expect.objectContaining({ fetch: expect.any(Function) }),
			'res-9',
			true
		);
	});

	it.each([
		[new TidalNotConnectedError(), 'not_connected'],
		[new TidalAuthError(), 'authorization_expired'],
		[new TidalApiError(404, 'Not Found', null, '/x'), 'not_found'],
		[new TidalApiError(500, 'Server Error', null, '/x'), 'unavailable'],
		[new Error('boom'), 'unavailable']
	])('maps errors thrown by run to the right state (%#)', async (error, state) => {
		await expect(
			loadTidalPage(event({ id: 'res-1' }), {
				getConnectionStatus: connected,
				failure,
				run: async () => {
					throw error;
				}
			})
		).resolves.toEqual({ data: null, state, configured: true, id: 'res-1' });
	});
});
