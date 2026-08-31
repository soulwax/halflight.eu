import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { buildAuthorizeUrl, createPkcePair, exchangeCode, refreshTokens } from './oauth';
import { TidalAuthError } from './errors';

const b64url = (buf: Buffer) => buf.toString('base64url');

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('pkce + authorize url', () => {
	it('creates a valid S256 challenge', () => {
		const { verifier, challenge } = createPkcePair();
		expect(challenge).toBe(b64url(createHash('sha256').update(verifier).digest()));
		expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('builds an authorize url with the required params', () => {
		const url = new URL(buildAuthorizeUrl({ state: 'st', challenge: 'ch' }));
		expect(url.origin + url.pathname).toBe('https://login.tidal.com/authorize');
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('code_challenge')).toBe('ch');
		expect(url.searchParams.get('state')).toBe('st');
		expect(url.searchParams.get('client_id')).toBe('test-client-id');
		expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/tidal/callback');
	});
});

describe('token exchange', () => {
	it('exchanges an auth code and maps the response', async () => {
		const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
			jsonResponse({
				access_token: 'at',
				refresh_token: 'rt',
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'user.read collection.read',
				user_id: 12345
			})
		);
		const before = Date.now();
		const record = await exchangeCode({ code: 'code', verifier: 'v' }, fetchMock as never);

		const init = fetchMock.mock.calls[0]![1]!;
		const body = init.body as URLSearchParams;
		expect(body.get('grant_type')).toBe('authorization_code');
		expect(body.get('code_verifier')).toBe('v');
		expect(body.get('client_id')).toBe('test-client-id');
		expect(body.get('client_secret')).toBe('test-client-secret');

		expect(record.accessToken).toBe('at');
		expect(record.refreshToken).toBe('rt');
		expect(record.userId).toBe('12345');
		expect(record.scope).toEqual(['user.read', 'collection.read']);
		expect(record.expiresAt).toBeGreaterThanOrEqual(before + 3600_000);
	});

	it('keeps the previous refresh token when TIDAL does not rotate it', async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({ access_token: 'at2', token_type: 'Bearer', expires_in: 3600 })
		);
		const record = await refreshTokens('old-refresh', fetchMock as never);
		expect(record.accessToken).toBe('at2');
		expect(record.refreshToken).toBe('old-refresh');
	});

	it('adopts a rotated refresh token when present', async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({
				access_token: 'at3',
				refresh_token: 'new-refresh',
				token_type: 'Bearer',
				expires_in: 3600
			})
		);
		const record = await refreshTokens('old-refresh', fetchMock as never);
		expect(record.refreshToken).toBe('new-refresh');
	});

	it('raises TidalAuthError on invalid_grant', async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({ error: 'invalid_grant', error_description: 'expired' }, 400)
		);
		await expect(refreshTokens('dead', fetchMock as never)).rejects.toBeInstanceOf(TidalAuthError);
	});
});
