import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken, getPlaybackToken, tidalFetch, resetRefreshGuard } from './client';
import {
	writePlaybackRecord,
	writeRecord,
	type TidalTokenRecord,
	type TokenRowStore,
	type TokenSlot
} from './store';
import { TidalAuthError, TidalNotConnectedError, TidalPlaybackNotLinkedError } from './errors';

function memoryStore() {
	const blobs: Record<TokenSlot, string | null> = { primary: null, playback: null };
	const store: TokenRowStore = {
		read: async (slot = 'primary') => blobs[slot],
		write: async (value, slot = 'primary') => {
			blobs[slot] = value;
		},
		clear: async (slot = 'primary') => {
			blobs[slot] = null;
		}
	};
	return store;
}

function record(overrides: Partial<TidalTokenRecord> = {}): TidalTokenRecord {
	return {
		accessToken: 'fresh-access',
		refreshToken: 'refresh-1',
		expiresAt: Date.now() + 3_600_000,
		tokenType: 'Bearer',
		scope: ['user.read'],
		obtainedAt: Date.now(),
		...overrides
	};
}

const tokenJson = (over: Record<string, unknown> = {}) =>
	new Response(
		JSON.stringify({
			access_token: 'refreshed-access',
			token_type: 'Bearer',
			expires_in: 3600,
			...over
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);

beforeEach(() => resetRefreshGuard());

describe('getAccessToken', () => {
	it('throws when nothing is connected', async () => {
		await expect(getAccessToken({ store: memoryStore() })).rejects.toBeInstanceOf(
			TidalNotConnectedError
		);
	});

	it('returns the stored token when it is still fresh', async () => {
		const store = memoryStore();
		await writeRecord(record(), store);
		const fetchMock = vi.fn();
		expect(await getAccessToken({ store, fetch: fetchMock as never })).toBe('fresh-access');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refreshes and persists when the token is within the skew window', async () => {
		const store = memoryStore();
		await writeRecord(record({ expiresAt: Date.now() + 5_000, refreshToken: 'r-old' }), store);
		const fetchMock = vi.fn(async () => tokenJson({ refresh_token: 'r-new' }));

		expect(await getAccessToken({ store, fetch: fetchMock as never })).toBe('refreshed-access');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// second call uses the freshly persisted (still-valid) token, no extra fetch
		expect(await getAccessToken({ store, fetch: fetchMock as never })).toBe('refreshed-access');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('coalesces concurrent refreshes into one token request', async () => {
		const store = memoryStore();
		await writeRecord(record({ expiresAt: Date.now() - 1 }), store);
		const fetchMock = vi.fn(async () => {
			await new Promise((r) => setTimeout(r, 10));
			return tokenJson();
		});

		const [a, b] = await Promise.all([
			getAccessToken({ store, fetch: fetchMock as never }),
			getAccessToken({ store, fetch: fetchMock as never })
		]);
		expect(a).toBe('refreshed-access');
		expect(b).toBe('refreshed-access');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('tidalFetch 401 handling', () => {
	it('refreshes once and retries after a 401, then succeeds', async () => {
		const store = memoryStore();
		await writeRecord(record(), store);

		const fetchMock = vi.fn(async (url: string) => {
			if (url.endsWith('/oauth2/token')) return tokenJson({ access_token: 'after-401' });
			const auth = fetchMock.mock.calls.filter(
				([u]) => !String(u).endsWith('/oauth2/token')
			).length;
			return new Response('{}', { status: auth === 1 ? 401 : 200 });
		});

		const res = await tidalFetch('/users/me', {}, { store, fetch: fetchMock as never });
		expect(res.status).toBe(200);
		const apiCalls = fetchMock.mock.calls.filter(([u]) => !String(u).endsWith('/oauth2/token'));
		const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/oauth2/token'));
		expect(apiCalls).toHaveLength(2);
		expect(tokenCalls).toHaveLength(1);
	});

	it('gives up with TidalAuthError when the retry is also a 401', async () => {
		const store = memoryStore();
		await writeRecord(record(), store);
		const fetchMock = vi.fn(async (url: string) => {
			if (url.endsWith('/oauth2/token')) return tokenJson();
			return new Response('{}', { status: 401 });
		});

		await expect(
			tidalFetch('/users/me', {}, { store, fetch: fetchMock as never })
		).rejects.toBeInstanceOf(TidalAuthError);
	});
});

describe('getPlaybackToken', () => {
	it('throws TidalPlaybackNotLinkedError when no device token is stored', async () => {
		await expect(getPlaybackToken({ store: memoryStore() })).rejects.toBeInstanceOf(
			TidalPlaybackNotLinkedError
		);
	});

	it('returns the stored device token when fresh, ignoring the primary token', async () => {
		const store = memoryStore();
		await writeRecord(record({ accessToken: 'browse-token' }), store);
		await writePlaybackRecord(record({ accessToken: 'device-token', scope: ['r_usr'] }), store);

		const fetchMock = vi.fn();
		expect(await getPlaybackToken({ store, fetch: fetchMock as never })).toBe('device-token');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refreshes an expired device token with the device credentials and persists it', async () => {
		const store = memoryStore();
		await writePlaybackRecord(
			record({
				accessToken: 'old-device',
				refreshToken: 'device-refresh',
				expiresAt: Date.now() - 1
			}),
			store
		);

		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			expect(url).toBe('https://auth.tidal.com/v1/oauth2/token');
			expect(String(init?.body)).toContain('grant_type=refresh_token');
			expect(String(init?.body)).toContain('4N3n6Q1x95LL5K7p'); // TIDDL_CLIENT_ID
			return new Response(
				JSON.stringify({ access_token: 'new-device', expires_in: 3600, token_type: 'Bearer' }),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		});

		expect(await getPlaybackToken({ store, fetch: fetchMock as never })).toBe('new-device');
		// second call uses the freshly persisted token, no extra refresh
		expect(await getPlaybackToken({ store, fetch: fetchMock as never })).toBe('new-device');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
