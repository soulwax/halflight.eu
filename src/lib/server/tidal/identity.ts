import { createOAuthAccountIssuer } from 'better-auth/db';
import { auth } from '#lib/server/auth';
import { log } from '#lib/server/log';
import { fetchTidalUser, TIDAL_SIGN_IN_PROVIDER } from './sign-in';
import { createDbTokenRowStore, readRecord } from './store';

const TIDAL_ISSUER = createOAuthAccountIssuer(TIDAL_SIGN_IN_PROVIDER);

/** Syn users already checked by this process, so the lazy backfill costs one lookup each. */
const linkedUsers = new Set<string>();

/**
 * Record that `tidalUserId` belongs to `userId` as a Better Auth `tidal` account
 * (token-less — tokens live only in `tidal_auth`). Without it, a listener who
 * connected TIDAL from settings and later presses "Continue with TIDAL" would
 * get a second, empty Syn account. A TIDAL account already bound to another
 * Syn user stays with that user.
 */
export async function linkTidalIdentity(userId: string, tidalUserId: string): Promise<void> {
	const ctx = await auth.$context;
	const owner = await ctx.internalAdapter.findAccountOwnerByKey({
		issuer: TIDAL_ISSUER,
		accountId: tidalUserId
	});
	if (owner) {
		if (owner.kind === 'owned' && owner.user.id !== userId) {
			log.warn('tidal: account is already the sign-in identity of another user', { userId });
		}
		return;
	}
	await ctx.internalAdapter.linkAccount({
		providerId: TIDAL_SIGN_IN_PROVIDER,
		issuer: TIDAL_ISSUER,
		accountId: tidalUserId,
		userId
	});
}

/**
 * Backfill the sign-in identity for a listener whose browse token predates
 * "Continue with TIDAL". Never throws; a miss only means the link is retried
 * on the next process start.
 */
export async function ensureTidalIdentityLinked(userId: string): Promise<void> {
	if (linkedUsers.has(userId)) return;
	linkedUsers.add(userId);
	try {
		const record = await readRecord(createDbTokenRowStore(userId));
		if (!record) return;
		const tidalUserId = record.userId ?? (await fetchTidalUser(record.accessToken))?.id;
		if (tidalUserId) await linkTidalIdentity(userId, tidalUserId);
	} catch (cause) {
		log.error('tidal: could not link sign-in identity', { cause });
	}
}
