import { createHash, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from '$app/env/private';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { administrator } from '#lib/server/db/schema';

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

export function isConfiguredAdministratorUsername(username: string): boolean {
	return normalizeUsername(username) === normalizedAdminUsername;
}

/** Compare password digests so differing lengths cannot short-circuit the check. */
export function hasAdministratorPassword(password: string): boolean {
	const expected = createHash('sha256').update(ADMIN_PASSWORD).digest();
	const supplied = createHash('sha256').update(password).digest();

	return timingSafeEqual(expected, supplied);
}

export function hasAdministratorCredentials(username: string, password: string): boolean {
	return isConfiguredAdministratorUsername(username) && hasAdministratorPassword(password);
}

export async function isAdministrator(userId: string): Promise<boolean> {
	const record = await db.query.administrator.findFirst({
		columns: { id: true },
		where: eq(administrator.userId, userId)
	});

	return Boolean(record);
}

/**
 * Atomically assigns the first successfully bootstrapped account as owner. There
 * is intentionally no application path to update or delete this assignment.
 */
export async function claimFirstAdministrator(userId: string): Promise<boolean> {
	const created = await db
		.insert(administrator)
		.values({ userId })
		.onConflictDoNothing({ target: administrator.id })
		.returning({ userId: administrator.userId });

	return created[0]?.userId === userId || (await isAdministrator(userId));
}
