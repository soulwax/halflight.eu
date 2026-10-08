import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { account, user } from '#lib/server/db/auth.schema';
import { administrator, userStatus } from '#lib/server/db/schema';
import { log } from '#lib/server/log';
import { getAdministratorEmail, getAdministratorGithubId, persistOwner } from './admin';

interface SessionIdentity {
	id: string;
	name?: string | null;
	email?: string | null;
}

interface AccessRecord {
	status: string | null;
	role: string | null;
	firstUserId: string | null;
	/** The user has a GitHub account row matching the configured owner's GitHub id. */
	ownsAdminGithub?: boolean | null;
}

/** Resolve request permissions in one fresh query, without caching revocations. */
async function readAccessRecord(id: string): Promise<AccessRecord | undefined> {
	const adminGithubId = await getAdministratorGithubId();
	const [record] = await db
		.select({
			status: userStatus.status,
			role: administrator.role,
			firstUserId: sql<string | null>`(select ${administrator.userId} from ${administrator}
				order by ${administrator.grantedAt}, ${administrator.id} limit 1)`,
			ownsAdminGithub: adminGithubId
				? sql<boolean>`exists(select 1 from ${account} where ${account.userId} = ${user.id}
					and ${account.providerId} = 'github' and ${account.accountId} = ${adminGithubId})`
				: sql<boolean>`false`
		})
		.from(user)
		.leftJoin(userStatus, eq(userStatus.userId, user.id))
		.leftJoin(administrator, eq(administrator.userId, user.id))
		.where(eq(user.id, id))
		.limit(1);
	return record;
}

export async function getRequestAccess(
	identity: SessionIdentity,
	lookup: (id: string) => Promise<AccessRecord | undefined> = readAccessRecord,
	persist: (id: string) => Promise<void> = persistOwner
): Promise<{ active: boolean; isAdministrator: boolean; isFirstAdministrator: boolean }> {
	const record = await lookup(identity.id);
	const active = Boolean(record && (record.status ?? 'active') === 'active');
	// Owner identities are ones a provider vouches for — never the free-text
	// `name`, which anyone can set at sign-up. Ownership belongs to the Syn
	// user, so every sign-in method linked to it (GitHub, TIDAL, email) carries it.
	const ownsAdminGithub = Boolean(record?.ownsAdminGithub);
	if (active && ownsAdminGithub && record?.role !== 'owner') {
		persist(identity.id).catch((cause) =>
			log.error('admin: could not record the owner role', { cause })
		);
	}
	const isFirstAdministrator =
		active &&
		(identity.email === getAdministratorEmail() ||
			ownsAdminGithub ||
			record?.role === 'owner' ||
			record?.firstUserId === identity.id);
	return {
		active,
		isAdministrator: active && (record?.role != null || isFirstAdministrator),
		isFirstAdministrator
	};
}
