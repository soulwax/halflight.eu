import { createHash } from 'node:crypto';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';
import { log } from '#lib/server/log';
import { getTidalConfig, TIDAL_API_BASE, TIDAL_AUTHORIZE_URL, TIDAL_TOKEN_URL } from './config';
import { TidalConfigError } from './errors';
import { createDbTokenRowStore, writeRecord, type TidalTokenRecord } from './store';

/** Better Auth provider id; the OAuth callback is `${ORIGIN}/api/auth/callback/tidal`. */
export const TIDAL_SIGN_IN_PROVIDER = 'tidal';

/** Fallback lifetime when the token response carries no `expires_in`. */
const DEFAULT_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

interface TidalUserDocument {
	data?: {
		id?: string | number;
		attributes?: {
			username?: string | null;
			firstName?: string | null;
			lastName?: string | null;
			email?: string | null;
			emailVerified?: boolean | null;
		};
	};
}

/**
 * TIDAL accounts without a shared email still need a unique, stable address:
 * Better Auth refuses to create a user without one.
 */
export function placeholderTidalEmail(tidalUserId: string): string {
	const digest = createHash('sha256').update(tidalUserId).digest('hex');
	return `tidal-${digest}@syn.invalid`;
}

/** Map a v2 `/users/me` document onto Better Auth's user-info shape. */
export function mapTidalUser(document: TidalUserDocument) {
	const id = document.data?.id;
	if (id == null || id === '') return null;
	const tidalUserId = String(id);
	const attributes = document.data?.attributes ?? {};
	const fullName = [attributes.firstName, attributes.lastName].filter(Boolean).join(' ').trim();
	const email = attributes.email?.trim();
	return {
		id: tidalUserId,
		name: fullName || attributes.username?.trim() || 'TIDAL listener',
		email: email || placeholderTidalEmail(tidalUserId),
		// Only an address TIDAL itself verified may auto-link to an existing account.
		emailVerified: Boolean(email && attributes.emailVerified)
	};
}

/**
 * The developer-app OAuth flow doubles as "Sign in with TIDAL", so signing in
 * also connects the browse token. Returns `null` when TIDAL is not configured,
 * which simply hides the option instead of breaking authentication.
 */
export function tidalSignInProvider(): GenericOAuthConfig | null {
	let config: ReturnType<typeof getTidalConfig>;
	try {
		config = getTidalConfig();
	} catch (err) {
		if (err instanceof TidalConfigError) return null;
		throw err;
	}

	return {
		providerId: TIDAL_SIGN_IN_PROVIDER,
		name: 'TIDAL',
		authorizationUrl: TIDAL_AUTHORIZE_URL,
		tokenUrl: TIDAL_TOKEN_URL,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		// Mirrors `tokenRequest` in oauth.ts: credentials travel in the form body.
		authentication: 'post',
		scopes: config.scopes,
		pkce: true,
		async getUserInfo(tokens) {
			const response = await fetch(`${TIDAL_API_BASE}/users/me`, {
				headers: {
					authorization: `Bearer ${tokens.accessToken}`,
					accept: 'application/vnd.api+json'
				}
			});
			if (!response.ok) {
				log.error('tidal: sign-in profile request failed', { status: response.status });
				return null;
			}
			return mapTidalUser((await response.json()) as TidalUserDocument);
		}
	};
}

let tidalSignInAvailable: boolean | undefined;

/** Whether the sign-in page should offer TIDAL. */
export function isTidalSignInAvailable(): boolean {
	tidalSignInAvailable ??= tidalSignInProvider() !== null;
	return tidalSignInAvailable;
}

/** The subset of a Better Auth `account` row the token bridge reads. */
export interface SignInAccount {
	id: string;
	providerId: string;
	accountId: string;
	userId: string;
	accessToken?: string | null;
	refreshToken?: string | null;
	accessTokenExpiresAt?: Date | string | null;
	scope?: string | null;
}

export function accountToTokenRecord(
	account: SignInAccount,
	now = Date.now()
): TidalTokenRecord | null {
	if (!account.accessToken || !account.refreshToken) return null;
	const expiresAt = account.accessTokenExpiresAt
		? new Date(account.accessTokenExpiresAt).getTime()
		: now + DEFAULT_ACCESS_TOKEN_TTL_MS;
	const scope = account.scope ? account.scope.split(/[\s,]+/).filter(Boolean) : [];
	return {
		accessToken: account.accessToken,
		refreshToken: account.refreshToken,
		expiresAt: Number.isFinite(expiresAt) ? expiresAt : now + DEFAULT_ACCESS_TOKEN_TTL_MS,
		tokenType: 'Bearer',
		scope: scope.length > 0 ? scope : getTidalConfig().scopes,
		obtainedAt: now,
		userId: account.accountId
	};
}

export interface TokenBridgeDeps {
	persist(userId: string, record: TidalTokenRecord): Promise<void>;
	/** Drop Better Auth's plaintext copy so `tidal_auth` stays the only source of truth. */
	scrub(accountId: string): Promise<void>;
}

const defaultBridgeDeps: TokenBridgeDeps = {
	persist: (userId, record) => writeRecord(record, createDbTokenRowStore(userId)),
	async scrub(accountRowId) {
		const [{ db }, { account }, { eq }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/auth.schema'),
			import('drizzle-orm')
		]);
		await db
			.update(account)
			.set({ accessToken: null, refreshToken: null, idToken: null })
			.where(eq(account.id, accountRowId));
	}
};

/**
 * Better Auth `account` create/update hook: move the tokens of a TIDAL sign-in
 * into the encrypted per-user `tidal_auth` primary slot. TIDAL may rotate
 * refresh tokens, so two live copies would drift — the auth row is scrubbed.
 * A failure here never blocks sign-in; the user can still connect from
 * Settings → TIDAL.
 */
export async function bridgeTidalSignInTokens(
	account: SignInAccount,
	deps: TokenBridgeDeps = defaultBridgeDeps
): Promise<void> {
	if (account.providerId !== TIDAL_SIGN_IN_PROVIDER) return;
	const record = accountToTokenRecord(account);
	if (!record) return;
	try {
		await deps.persist(account.userId, record);
		await deps.scrub(account.id);
	} catch (cause) {
		log.error('tidal: could not store sign-in tokens', { cause });
	}
}
