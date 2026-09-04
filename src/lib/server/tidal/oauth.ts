import { createHash, randomBytes } from 'node:crypto';
import { getTidalConfig, TIDAL_AUTHORIZE_URL, TIDAL_TOKEN_URL } from './config';
import { TidalAuthError, TidalError } from './errors';
import type { TidalTokenRecord } from './store';

const base64url = (buf: Buffer) => buf.toString('base64url');

export interface PkcePair {
	verifier: string;
	challenge: string;
}

/** Create a PKCE verifier/challenge pair (S256). */
export function createPkcePair(): PkcePair {
	const verifier = base64url(randomBytes(32));
	const challenge = base64url(createHash('sha256').update(verifier).digest());
	return { verifier, challenge };
}

/** Opaque anti-CSRF value for the `state` parameter. */
export function createState(): string {
	return base64url(randomBytes(24));
}

/** Build the URL to redirect the user to for consent. */
export function buildAuthorizeUrl(params: { state: string; challenge: string }): string {
	const config = getTidalConfig();
	const url = new URL(TIDAL_AUTHORIZE_URL);
	url.search = new URLSearchParams({
		response_type: 'code',
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: config.scopes.join(' '),
		code_challenge_method: 'S256',
		code_challenge: params.challenge,
		state: params.state
	}).toString();
	return url.toString();
}

interface TidalTokenResponse {
	access_token: string;
	token_type?: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
	user_id?: number | string;
}

type FetchLike = typeof fetch;

async function tokenRequest(
	body: Record<string, string>,
	fetchImpl: FetchLike
): Promise<TidalTokenResponse> {
	const config = getTidalConfig();
	const form = new URLSearchParams({ ...body, client_id: config.clientId });
	if (config.clientSecret) form.set('client_secret', config.clientSecret);

	const response = await fetchImpl(TIDAL_TOKEN_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json'
		},
		body: form
	});

	const text = await response.text();
	let json: unknown;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { error: 'invalid_response', error_description: text.slice(0, 200) };
	}

	if (!response.ok) {
		const err = json as { error?: string; error_description?: string };
		// invalid_grant => the refresh token / auth code is dead; caller must reconnect.
		if (response.status === 400 || response.status === 401) {
			throw new TidalAuthError(
				`TIDAL token endpoint rejected the request: ${err.error_description ?? err.error ?? response.statusText}`
			);
		}
		throw new TidalError(
			`TIDAL token endpoint error ${response.status}: ${err.error_description ?? err.error ?? response.statusText}`
		);
	}

	return json as TidalTokenResponse;
}

function toRecord(res: TidalTokenResponse, previousRefreshToken?: string): TidalTokenRecord {
	const now = Date.now();
	const refreshToken = res.refresh_token ?? previousRefreshToken;
	if (!refreshToken) {
		throw new TidalError('TIDAL token response contained no refresh token.');
	}
	return {
		accessToken: res.access_token,
		refreshToken,
		expiresAt: now + res.expires_in * 1000,
		tokenType: res.token_type ?? 'Bearer',
		scope: res.scope ? res.scope.split(/\s+/) : [],
		obtainedAt: now,
		userId: res.user_id != null ? String(res.user_id) : undefined
	};
}

/** Exchange an authorization code for a token record. */
export async function exchangeCode(
	params: { code: string; verifier: string },
	fetchImpl: FetchLike = fetch
): Promise<TidalTokenRecord> {
	const res = await tokenRequest(
		{
			grant_type: 'authorization_code',
			code: params.code,
			redirect_uri: getTidalConfig().redirectUri,
			code_verifier: params.verifier
		},
		fetchImpl
	);
	return toRecord(res);
}

import { refreshDeviceToken } from './device-auth';

/**
 * Redeem a refresh token for a fresh access token. Carries the previous refresh
 * token forward when TIDAL does not return a rotated one.
 * Automatically handles device-authorization tokens when scope contains `r_usr`.
 */
export async function refreshTokens(
	refreshToken: string,
	fetchImpl: FetchLike = fetch,
	scope?: string[],
	countryCode?: string
): Promise<TidalTokenRecord> {
	if (scope?.includes('r_usr')) {
		return refreshDeviceToken(refreshToken, fetchImpl, countryCode);
	}

	try {
		const res = await tokenRequest(
			{ grant_type: 'refresh_token', refresh_token: refreshToken },
			fetchImpl
		);
		return toRecord(res, refreshToken);
	} catch (err) {
		if (err instanceof TidalAuthError) {
			try {
				return await refreshDeviceToken(refreshToken, fetchImpl, countryCode);
			} catch {
				throw err;
			}
		}
		throw err;
	}
}
