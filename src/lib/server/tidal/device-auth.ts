import { TidalAuthError, TidalError } from './errors';
import type { TidalTokenRecord } from './store';

export const TIDDL_CLIENT_ID = '4N3n6Q1x95LL5K7p';
export const TIDDL_CLIENT_SECRET = 'oKOXfJW371cX6xaZ0PyhgGNBdNLlBZd4AKKYougMjik=';
export const TIDDL_SCOPE = 'r_usr+w_usr+w_sub';

const TIDAL_AUTH_BASE = 'https://auth.tidal.com/v1/oauth2';

export interface DeviceAuthorizationResponse {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string;
	expiresIn: number;
	interval: number;
}

export interface DeviceTokenSuccess {
	status: 'success';
	record: TidalTokenRecord;
	countryCode?: string;
}

export interface DeviceTokenPending {
	status: 'pending';
}

export interface DeviceTokenExpired {
	status: 'expired';
}

export type DeviceTokenResult = DeviceTokenSuccess | DeviceTokenPending | DeviceTokenExpired;

function getBasicAuthHeader(
	clientId = TIDDL_CLIENT_ID,
	clientSecret = TIDDL_CLIENT_SECRET
): string {
	return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/**
 * Initiates the TIDAL Device Authorization Flow (from tiddl/core/auth/client.py).
 * Returns verification URL (e.g. link.tidal.com/ABCD) and device code.
 */
export async function requestDeviceAuthorization(
	fetchImpl: typeof fetch = fetch
): Promise<DeviceAuthorizationResponse> {
	const body = new URLSearchParams({
		client_id: TIDDL_CLIENT_ID,
		scope: TIDDL_SCOPE
	});

	const response = await fetchImpl(`${TIDAL_AUTH_BASE}/device_authorization`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json'
		},
		body
	});

	if (!response.ok) {
		const text = await response.text();
		throw new TidalError(`Failed to request device authorization (${response.status}): ${text}`);
	}

	const data = (await response.json()) as DeviceAuthorizationResponse;
	return data;
}

/**
 * Polls the TIDAL token endpoint for approval of a device code.
 * Returns { status: 'pending' } while waiting, { status: 'expired' } if timeout,
 * or { status: 'success', record } once authorized.
 */
export async function pollDeviceToken(
	deviceCode: string,
	fetchImpl: typeof fetch = fetch
): Promise<DeviceTokenResult> {
	const body = new URLSearchParams({
		client_id: TIDDL_CLIENT_ID,
		device_code: deviceCode,
		grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
		scope: TIDDL_SCOPE
	});

	const response = await fetchImpl(`${TIDAL_AUTH_BASE}/token`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json',
			authorization: getBasicAuthHeader()
		},
		body
	});

	if (response.status === 400 || response.status === 401) {
		const err = (await response.json().catch(() => ({}))) as {
			error?: string;
			error_description?: string;
		};
		if (err.error === 'authorization_pending') {
			return { status: 'pending' };
		}
		if (err.error === 'expired_token') {
			return { status: 'expired' };
		}
		throw new TidalAuthError(
			`TIDAL device auth rejected: ${err.error_description || err.error || response.statusText}`
		);
	}

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new TidalError(`TIDAL device token error (${response.status}): ${text}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		token_type?: string;
		scope?: string;
		user_id?: number | string;
		user?: {
			userId?: number;
			countryCode?: string;
		};
	};

	const record: TidalTokenRecord = {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000,
		tokenType: data.token_type || 'Bearer',
		scope: (data.scope || TIDDL_SCOPE).split(/[+ ]/),
		obtainedAt: Date.now(),
		userId: data.user_id
			? String(data.user_id)
			: data.user?.userId
				? String(data.user.userId)
				: undefined
	};

	return {
		status: 'success',
		record,
		countryCode: data.user?.countryCode
	};
}

/**
 * Refreshes a TIDAL token issued via the device authorization credentials.
 */
export async function refreshDeviceToken(
	refreshToken: string,
	fetchImpl: typeof fetch = fetch
): Promise<TidalTokenRecord> {
	const body = new URLSearchParams({
		client_id: TIDDL_CLIENT_ID,
		refresh_token: refreshToken,
		grant_type: 'refresh_token',
		scope: TIDDL_SCOPE
	});

	const response = await fetchImpl(`${TIDAL_AUTH_BASE}/token`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json',
			authorization: getBasicAuthHeader()
		},
		body
	});

	if (!response.ok) {
		const err = (await response.json().catch(() => ({}))) as {
			error?: string;
			error_description?: string;
		};
		throw new TidalAuthError(
			`TIDAL device refresh rejected: ${err.error_description || err.error || response.statusText}`
		);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		token_type?: string;
		scope?: string;
		user_id?: number | string;
	};

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token || refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000,
		tokenType: data.token_type || 'Bearer',
		scope: (data.scope || TIDDL_SCOPE).split(/[+ ]/),
		obtainedAt: Date.now(),
		userId: data.user_id ? String(data.user_id) : undefined
	};
}
