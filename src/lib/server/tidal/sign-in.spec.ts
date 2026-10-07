import { describe, it, expect, vi } from 'vitest';
import {
	accountToTokenRecord,
	bridgeTidalSignInTokens,
	mapTidalUser,
	placeholderTidalEmail,
	tidalSignInProvider,
	type SignInAccount
} from './sign-in';
import { getTidalConfig, TIDAL_AUTHORIZE_URL, TIDAL_TOKEN_URL } from './config';

// The suite runs against whatever `.env` provides, so assert against the
// resolved config rather than hard-coded fixture values.
const config = getTidalConfig();

function tidalAccount(overrides: Partial<SignInAccount> = {}): SignInAccount {
	return {
		id: 'acct-row',
		providerId: 'tidal',
		accountId: '424242',
		userId: 'syn-user',
		accessToken: 'at',
		refreshToken: 'rt',
		accessTokenExpiresAt: new Date(1_700_003_600_000),
		scope: 'user.read,search.read',
		...overrides
	};
}

describe('tidalSignInProvider', () => {
	it('reuses the developer app endpoints, credentials and scopes', () => {
		const provider = tidalSignInProvider();
		expect(provider).toMatchObject({
			providerId: 'tidal',
			authorizationUrl: TIDAL_AUTHORIZE_URL,
			tokenUrl: TIDAL_TOKEN_URL,
			clientId: config.clientId,
			scopes: config.scopes,
			pkce: true,
			authentication: 'post'
		});
	});
});

describe('mapTidalUser', () => {
	it('maps a v2 /users/me document', () => {
		expect(
			mapTidalUser({
				data: {
					id: 424242,
					attributes: {
						username: 'listener',
						firstName: 'Ada',
						lastName: 'Lovelace',
						email: 'ada@example.com',
						emailVerified: true
					}
				}
			})
		).toEqual({
			id: '424242',
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			emailVerified: true
		});
	});

	it('falls back to the username and a stable placeholder email', () => {
		const user = mapTidalUser({ data: { id: '7', attributes: { username: 'quiet' } } });
		expect(user).toEqual({
			id: '7',
			name: 'quiet',
			email: placeholderTidalEmail('7'),
			emailVerified: false
		});
		expect(placeholderTidalEmail('7')).toMatch(/^tidal-[0-9a-f]{64}@syn\.invalid$/);
	});

	it('never reports an email TIDAL did not verify as verified', () => {
		const user = mapTidalUser({ data: { id: '7', attributes: { email: 'x@example.com' } } });
		expect(user?.emailVerified).toBe(false);
	});

	it('rejects a document without a user id', () => {
		expect(mapTidalUser({ data: { attributes: { username: 'nobody' } } })).toBeNull();
		expect(mapTidalUser({})).toBeNull();
	});
});

describe('accountToTokenRecord', () => {
	it('converts a Better Auth account row into a token record', () => {
		const now = 1_700_000_000_000;
		expect(accountToTokenRecord(tidalAccount(), now)).toEqual({
			accessToken: 'at',
			refreshToken: 'rt',
			expiresAt: new Date(1_700_003_600_000).getTime(),
			tokenType: 'Bearer',
			scope: ['user.read', 'search.read'],
			obtainedAt: now,
			userId: '424242'
		});
	});

	it('defaults expiry and scopes when the row lacks them', () => {
		const now = 1_000;
		const record = accountToTokenRecord(
			tidalAccount({ accessTokenExpiresAt: null, scope: null }),
			now
		);
		expect(record?.expiresAt).toBe(now + 60 * 60 * 1000);
		expect(record?.scope).toEqual(config.scopes);
	});

	it('returns null without a refresh token', () => {
		expect(accountToTokenRecord(tidalAccount({ refreshToken: null }))).toBeNull();
	});
});

describe('bridgeTidalSignInTokens', () => {
	it('stores the tokens for the owning user, then scrubs the auth row', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const scrub = vi.fn().mockResolvedValue(undefined);
		await bridgeTidalSignInTokens(tidalAccount(), { persist, scrub });

		expect(persist).toHaveBeenCalledWith(
			'syn-user',
			expect.objectContaining({ accessToken: 'at', refreshToken: 'rt', userId: '424242' })
		);
		expect(scrub).toHaveBeenCalledWith('acct-row');
		expect(persist.mock.invocationCallOrder[0]).toBeLessThan(scrub.mock.invocationCallOrder[0]);
	});

	it('ignores other providers', async () => {
		const persist = vi.fn();
		const scrub = vi.fn();
		await bridgeTidalSignInTokens(tidalAccount({ providerId: 'github' }), { persist, scrub });
		await bridgeTidalSignInTokens(tidalAccount({ providerId: 'credential' }), { persist, scrub });
		expect(persist).not.toHaveBeenCalled();
		expect(scrub).not.toHaveBeenCalled();
	});

	it('ignores an already scrubbed row', async () => {
		const persist = vi.fn();
		const scrub = vi.fn();
		await bridgeTidalSignInTokens(tidalAccount({ accessToken: null, refreshToken: null }), {
			persist,
			scrub
		});
		expect(persist).not.toHaveBeenCalled();
	});

	it('keeps the auth copy and never throws when storing fails', async () => {
		const persist = vi.fn().mockRejectedValue(new Error('db down'));
		const scrub = vi.fn();
		await expect(
			bridgeTidalSignInTokens(tidalAccount(), { persist, scrub })
		).resolves.toBeUndefined();
		expect(scrub).not.toHaveBeenCalled();
	});
});
