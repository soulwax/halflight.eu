/**
 * Server-only TIDAL integration. Import from `#lib/server/tidal` in `+server.ts`
 * / `+page.server.ts` / other server modules — never from client code.
 *
 * Typical use in a feature:
 *
 * ```ts
 * import { tidalJson } from '#lib/server/tidal';
 * export const load = async (event) => {
 *   const me = await tidalJson('/users/me', {}, { fetch: event.fetch });
 *   return { me };
 * };
 * ```
 */
export * from './errors';
export {
	getTidalConfig,
	resetTidalConfigCache,
	DEFAULT_SCOPES,
	TIDAL_API_BASE,
	TIDAL_AUTHORIZE_URL,
	TIDAL_TOKEN_URL
} from './config';
export {
	getAccessToken,
	tidalFetch,
	tidalJson,
	resetRefreshGuard,
	type TidalRequestContext
} from './client';
export {
	buildAuthorizeUrl,
	createPkcePair,
	createState,
	exchangeCode,
	refreshTokens,
	type PkcePair
} from './oauth';
export {
	readRecord,
	writeRecord,
	clearRecord,
	dbTokenRowStore,
	type TidalTokenRecord,
	type TokenRowStore
} from './store';
export { clearTokenCookie, readTokenCookie, writeTokenCookie, TIDAL_TOKEN_COOKIE } from './cookie';
export { seal, open } from './crypto';
export * as tidalApi from './api';
export * from './jsonapi';
export { getConnectionStatus, type TidalConnectionStatus } from './status';
