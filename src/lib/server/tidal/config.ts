import {
	ORIGIN,
	TIDAL_CLIENT_ID,
	TIDAL_CLIENT_SECRET,
	TIDAL_REDIRECT_URI,
	TIDAL_SCOPES,
	TIDAL_TOKEN_ENC_KEY
} from '$app/env/private';
import { TidalConfigError } from './errors';

export const TIDAL_AUTHORIZE_URL = 'https://login.tidal.com/authorize';
export const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
export const TIDAL_API_BASE = 'https://openapi.tidal.com/v2';

export const WRITE_SCOPES = ['playlists.write'] as const;

/** Scopes requested when none are configured. Read-only, broad coverage. */
export const DEFAULT_SCOPES = [
	'user.read',
	'entitlements.read',
	'collection.read',
	'playlists.read',
	'playlists.write',
	'recommendations.read',
	'search.read'
];

export interface TidalConfig {
	clientId: string;
	/** `undefined` for a public (PKCE-only) client. */
	clientSecret: string | undefined;
	redirectUri: string;
	scopes: string[];
	/** 32-byte AES key. */
	encryptionKey: Buffer;
}

let cached: TidalConfig | undefined;

function decodeKey(raw: string): Buffer {
	let key: Buffer;
	try {
		key = Buffer.from(raw, 'base64');
	} catch {
		throw new TidalConfigError('TIDAL_TOKEN_ENC_KEY is not valid base64.');
	}
	if (key.length !== 32) {
		throw new TidalConfigError(
			`TIDAL_TOKEN_ENC_KEY must decode to 32 bytes (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`
		);
	}
	return key;
}

/**
 * Resolve and validate the TIDAL configuration. Throws {@link TidalConfigError}
 * with an actionable message when something required is missing — call this at
 * feature-use time, never at module load, so the rest of the app still boots.
 */
export function getTidalConfig(): TidalConfig {
	if (cached) return cached;

	const missing: string[] = [];
	if (!TIDAL_CLIENT_ID) missing.push('TIDAL_CLIENT_ID');
	if (!TIDAL_TOKEN_ENC_KEY) missing.push('TIDAL_TOKEN_ENC_KEY');
	if (!ORIGIN && !TIDAL_REDIRECT_URI) missing.push('ORIGIN or TIDAL_REDIRECT_URI');
	if (missing.length > 0) {
		throw new TidalConfigError(
			`Missing required environment variable(s): ${missing.join(', ')}. See .env.example.`
		);
	}

	const redirectUri = TIDAL_REDIRECT_URI || `${ORIGIN!.replace(/\/$/, '')}/tidal/callback`;
	if (!URL.canParse(redirectUri)) {
		throw new TidalConfigError(`TIDAL_REDIRECT_URI is not a valid URL: ${redirectUri}`);
	}

	const scopes = (TIDAL_SCOPES?.trim() ? TIDAL_SCOPES.trim().split(/\s+/) : DEFAULT_SCOPES).sort();

	cached = {
		clientId: TIDAL_CLIENT_ID!,
		clientSecret: TIDAL_CLIENT_SECRET || undefined,
		redirectUri,
		scopes,
		encryptionKey: decodeKey(TIDAL_TOKEN_ENC_KEY!)
	};
	return cached;
}

/** Test-only: drop the memoised config. */
export function resetTidalConfigCache(): void {
	cached = undefined;
}
