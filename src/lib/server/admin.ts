import { createHash } from 'node:crypto';
import { ADMIN_GITHUB_ID, ADMIN_USERNAME } from '$app/env/private';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { administrator, userStatus } from '#lib/server/db/schema';
import { account, user } from '#lib/server/db/auth.schema';
import { log } from '#lib/server/log';

const normalizedAdminUsername = normalizeUsername(ADMIN_USERNAME);

/** GitHub usernames are case-insensitive, unlike display names. */
export function normalizeUsername(value: string): string {
	return value.trim().toLocaleLowerCase('en-US');
}

/**
 * A private, deterministic email lets Better Auth's email/password and GitHub
 * providers link to one user without storing an email address in configuration.
 */
export function getAdministratorEmail(username = normalizedAdminUsername): string {
	const digest = createHash('sha256').update(normalizeUsername(username)).digest('hex');
	return `admin-${digest}@syn.invalid`;
}

/**
 * Only for values GitHub itself vouches for (an OAuth profile `login`). A
 * user's `name` is free text — from email sign-up, a GitHub display name or a
 * TIDAL profile — and must never be compared with this.
 */
export function isConfiguredAdministratorUsername(username: string): boolean {
	return normalizeUsername(username) === normalizedAdminUsername;
}

const GITHUB_ID_RETRY_MS = 5 * 60 * 1000;
let resolvedGithubId: Promise<string | null> | undefined;
let githubIdFailedAt = 0;

/**
 * The owner's immutable GitHub user id. `ADMIN_GITHUB_ID` pins it; otherwise
 * `ADMIN_USERNAME` is resolved once per process through GitHub's public API
 * (retried after a few minutes if that fails).
 */
export function getAdministratorGithubId(fetchImpl: typeof fetch = fetch): Promise<string | null> {
	const pinned = ADMIN_GITHUB_ID?.trim();
	if (pinned) return Promise.resolve(pinned);
	if (!normalizedAdminUsername) return Promise.resolve(null);
	if (resolvedGithubId && githubIdFailedAt && Date.now() - githubIdFailedAt > GITHUB_ID_RETRY_MS) {
		resolvedGithubId = undefined;
	}
	resolvedGithubId ??= (async () => {
		try {
			const response = await fetchImpl(
				`https://api.github.com/users/${encodeURIComponent(normalizedAdminUsername)}`,
				{ headers: { accept: 'application/vnd.github+json', 'user-agent': 'halflight' } }
			);
			if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
			const body = (await response.json()) as { id?: number | string };
			if (body.id == null) throw new Error('GitHub user has no id');
			githubIdFailedAt = 0;
			return String(body.id);
		} catch (cause) {
			githubIdFailedAt = Date.now();
			log.warn('admin: could not resolve the administrator GitHub id', { cause });
			return null;
		}
	})();
	return resolvedGithubId;
}

/** Test-only: forget the resolved GitHub id. */
export function resetAdministratorGithubId(): void {
	resolvedGithubId = undefined;
	githubIdFailedAt = 0;
}

/** Whether this user has signed in with the owner's GitHub account. */
export async function ownsAdministratorGithubAccount(userId: string): Promise<boolean> {
	const githubId = await getAdministratorGithubId();
	if (!githubId) return false;
	const rows = await db
		.select({ id: account.id })
		.from(account)
		.where(
			and(
				eq(account.userId, userId),
				eq(account.providerId, 'github'),
				eq(account.accountId, githubId)
			)
		)
		.limit(1);
	return rows.length > 0;
}

/**
 * Record the owner durably. Ownership then belongs to the Syn user, not to the
 * GitHub session, so any sign-in method linked to that user (TIDAL included)
 * carries it.
 */
export async function persistOwner(userId: string): Promise<void> {
	await db
		.insert(administrator)
		.values({ userId, role: 'owner' })
		.onConflictDoUpdate({ target: administrator.userId, set: { role: 'owner' } });
}

export async function getAdministratorRecord(userId: string) {
	return db.query.administrator.findFirst({
		where: eq(administrator.userId, userId)
	});
}

/**
 * Checks whether this user is the primary owner / first administrator.
 * The owner is either configured via ADMIN_USERNAME (soulwax), has role 'owner',
 * or is the earliest granted administrator in the database.
 */
export async function isFirstAdministrator(
	target: string | { id: string; name?: string | null; email?: string | null }
): Promise<boolean> {
	if (typeof target !== 'string') {
		if (target.email && target.email === getAdministratorEmail()) return true;
		return isFirstAdministrator(target.id);
	}

	const userId = target;
	const [userRecord, adminRecord] = await Promise.all([
		db.query.user.findFirst({ where: eq(user.id, userId) }),
		getAdministratorRecord(userId)
	]);

	if (userRecord?.email && userRecord.email === getAdministratorEmail()) return true;
	if (adminRecord?.role === 'owner') return true;
	if (await ownsAdministratorGithubAccount(userId)) {
		await persistOwner(userId);
		return true;
	}

	const first = await db.query.administrator.findFirst({
		orderBy: [asc(administrator.grantedAt), asc(administrator.id)]
	});

	return first?.userId === userId;
}

export async function isAdministrator(userId: string): Promise<boolean> {
	const [record, isFirst] = await Promise.all([
		db.query.administrator.findFirst({
			columns: { id: true },
			where: eq(administrator.userId, userId)
		}),
		isFirstAdministrator(userId)
	]);

	return Boolean(record) || isFirst;
}

/**
 * Atomically assigns the first successfully bootstrapped account as owner.
 */
export async function claimFirstAdministrator(userId: string): Promise<boolean> {
	const isFirst = await isFirstAdministrator(userId);
	const existingFirst = await db.query.administrator.findFirst({
		orderBy: [asc(administrator.grantedAt), asc(administrator.id)]
	});

	if (existingFirst) {
		if (isFirst || existingFirst.userId === userId) {
			return true;
		}
		return isAdministrator(userId);
	}

	const created = await db
		.insert(administrator)
		.values({ userId, role: 'owner' })
		.onConflictDoNothing({ target: administrator.userId })
		.returning({ userId: administrator.userId });

	return created[0]?.userId === userId || (await isAdministrator(userId));
}

/**
 * Grants administrator privileges to an existing user.
 */
export async function addAdministrator(userId: string): Promise<boolean> {
	const res = await db
		.insert(administrator)
		.values({ userId, role: 'admin' })
		.onConflictDoNothing({ target: administrator.userId })
		.returning({ userId: administrator.userId });

	return res.length > 0 || (await isAdministrator(userId));
}

/**
 * Revokes administrator privileges from a user.
 * The primary owner / first administrator can never be demoted.
 */
export async function removeAdministrator(userId: string): Promise<boolean> {
	if (await isFirstAdministrator(userId)) {
		return false; // Protect owner
	}

	const deleted = await db
		.delete(administrator)
		.where(eq(administrator.userId, userId))
		.returning({ userId: administrator.userId });

	return deleted.length > 0;
}

export type UserAction = 'demote' | 'kick' | 'ban' | 'archive' | 'unban' | 'promote';

/**
 * Permission check based on Syn role hierarchy:
 * - First admin (soulwax from env): can manage everyone except themselves. Cannot demote themselves.
 * - Admin: can manage regular users only. Cannot touch other admins or first admin.
 * - User: cannot manage anyone.
 */
export async function canManageUser(
	actorUserId: string,
	targetUserId: string,
	_action: UserAction
): Promise<{ allowed: boolean; reason?: string }> {
	if (actorUserId === targetUserId) {
		return { allowed: false, reason: 'You cannot perform administrative actions on yourself' };
	}

	const [actorIsFirst, actorIsAdmin, targetIsFirst, targetIsAdmin] = await Promise.all([
		isFirstAdministrator(actorUserId),
		isAdministrator(actorUserId),
		isFirstAdministrator(targetUserId),
		isAdministrator(targetUserId)
	]);

	if (!actorIsAdmin && !actorIsFirst) {
		return { allowed: false, reason: 'Only administrators can manage users' };
	}

	// First admin has universal authority over all other accounts
	if (actorIsFirst) {
		return { allowed: true };
	}

	// Admins cannot touch first admin
	if (targetIsFirst) {
		return { allowed: false, reason: 'Admins cannot modify the first administrator' };
	}

	// Admins cannot touch other admins
	if (targetIsAdmin) {
		return { allowed: false, reason: 'Admins cannot modify other administrators' };
	}

	// Admins can manage regular users
	return { allowed: true };
}

export async function setUserStatus(
	targetUserId: string,
	status: 'active' | 'archived' | 'banned',
	reason?: string
): Promise<void> {
	await db
		.insert(userStatus)
		.values({ userId: targetUserId, status, reason })
		.onConflictDoUpdate({
			target: userStatus.userId,
			set: { status, reason, updatedAt: new Date() }
		});
}

export async function kickUser(targetUserId: string): Promise<boolean> {
	const deleted = await db.delete(user).where(eq(user.id, targetUserId)).returning({ id: user.id });
	return deleted.length > 0;
}

export interface ManagedUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	createdAt: Date;
	adminRole: 'owner' | 'admin' | null;
	isFirstAdmin: boolean;
	status: 'active' | 'archived' | 'banned';
	statusReason?: string | null;
}

/**
 * Retrieves all registered users with their administrator and moderation status.
 */
export async function getAllUsersWithAdminStatus(): Promise<ManagedUser[]> {
	const [allUsers, allAdmins, allStatuses] = await Promise.all([
		db.select().from(user).orderBy(asc(user.createdAt)),
		db.select().from(administrator).orderBy(asc(administrator.grantedAt), asc(administrator.id)),
		db.select().from(userStatus)
	]);

	const adminMap = new Map(allAdmins.map((a) => [a.userId, a.role]));
	const statusMap = new Map(allStatuses.map((s) => [s.userId, s]));

	let firstAdminUserId: string | null = null;
	for (const u of allUsers) {
		if (u.email === getAdministratorEmail()) {
			firstAdminUserId = u.id;
			break;
		}
	}
	if (!firstAdminUserId) {
		firstAdminUserId =
			allAdmins.length > 0
				? (allAdmins.find((a) => a.role === 'owner')?.userId ?? allAdmins[0].userId)
				: null;
	}

	return allUsers.map((u) => {
		const isFirst = u.id === firstAdminUserId;
		const role = isFirst ? 'owner' : ((adminMap.get(u.id) as 'admin' | undefined) ?? null);
		const s = statusMap.get(u.id);

		return {
			id: u.id,
			name: u.name,
			email: u.email,
			emailVerified: u.emailVerified,
			createdAt: u.createdAt,
			adminRole: role,
			isFirstAdmin: isFirst,
			status: (s?.status as 'active' | 'archived' | 'banned') ?? 'active',
			statusReason: s?.reason ?? null
		};
	});
}
