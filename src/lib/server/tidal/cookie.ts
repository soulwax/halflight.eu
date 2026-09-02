import type { Cookies } from '@sveltejs/kit';
import { getTidalConfig } from './config';
import { open, seal } from './crypto';
import type { TidalTokenRecord } from './store';

export const TIDAL_TOKEN_COOKIE = 'tidal_token';

const TOKEN_COOKIE_OPTIONS = {
	path: '/app',
	httpOnly: true,
	secure: true,
	sameSite: 'strict' as const,
	maxAge: 60 * 60 * 24 * 30
};

export function writeTokenCookie(cookies: Cookies, record: TidalTokenRecord): void {
	cookies.set(
		TIDAL_TOKEN_COOKIE,
		seal(JSON.stringify(record), getTidalConfig().encryptionKey),
		TOKEN_COOKIE_OPTIONS
	);
}

export function readTokenCookie(cookies: Cookies): TidalTokenRecord | null {
	const value = cookies.get(TIDAL_TOKEN_COOKIE);
	if (!value) return null;

	try {
		const record = JSON.parse(open(value, getTidalConfig().encryptionKey)) as TidalTokenRecord;
		return typeof record.accessToken === 'string' && typeof record.refreshToken === 'string'
			? record
			: null;
	} catch {
		return null;
	}
}

export function clearTokenCookie(cookies: Cookies): void {
	cookies.delete(TIDAL_TOKEN_COOKIE, { path: TOKEN_COOKIE_OPTIONS.path });
}
