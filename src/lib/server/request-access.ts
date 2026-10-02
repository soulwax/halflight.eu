import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { user } from '#lib/server/db/auth.schema';
import { administrator, userStatus } from '#lib/server/db/schema';
import { getAdministratorEmail, isConfiguredAdministratorUsername } from './admin';

interface SessionIdentity {
	id: string;
	name?: string | null;
	email?: string | null;
}

interface AccessRecord {
	status: string | null;
	role: string | null;
	firstUserId: string | null;
}

/** Resolve request permissions in one fresh query, without caching revocations. */
async function readAccessRecord(id: string): Promise<AccessRecord | undefined> {
	const [record] = await db
		.select({
			status: userStatus.status,
			role: administrator.role,
			firstUserId: sql<string | null>`(select ${administrator.userId} from ${administrator}
				order by ${administrator.grantedAt}, ${administrator.id} limit 1)`
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
	lookup: (id: string) => Promise<AccessRecord | undefined> = readAccessRecord
): Promise<{ active: boolean; isAdministrator: boolean; isFirstAdministrator: boolean }> {
	const record = await lookup(identity.id);
	const active = Boolean(record && (record.status ?? 'active') === 'active');
	const isFirstAdministrator =
		active &&
		(Boolean(identity.name && isConfiguredAdministratorUsername(identity.name)) ||
			identity.email === getAdministratorEmail() ||
			record?.role === 'owner' ||
			record?.firstUserId === identity.id);
	return {
		active,
		isAdministrator: active && (record?.role != null || isFirstAdministrator),
		isFirstAdministrator
	};
}
