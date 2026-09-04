import { error, fail } from '@sveltejs/kit';
import { count } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { user } from '#lib/server/db/auth.schema';
import { administrator, userPlaylist, tidalAuth } from '#lib/server/db/schema';
import {
	canManageUser,
	addAdministrator,
	removeAdministrator,
	setUserStatus,
	kickUser,
	getAllUsersWithAdminStatus
} from '#lib/server/admin';
import { getConnectionStatus } from '#lib/server/tidal';
import { auth } from '#lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = event.locals.user;
	if (!currentUser || !event.locals.isAdministrator) {
		throw error(403, 'Forbidden: Administrator access required');
	}

	const dbStats = await (async () => {
		const startTime = performance.now();
		try {
			const [uCount, aCount, pCount, tCount] = await Promise.all([
				db.select({ value: count() }).from(user),
				db.select({ value: count() }).from(administrator),
				db.select({ value: count() }).from(userPlaylist),
				db.select({ value: count() }).from(tidalAuth)
			]);

			return {
				dbLatencyMs: Math.round((performance.now() - startTime) * 10) / 10,
				userCount: Number(uCount[0]?.value ?? 0),
				adminCount: Number(aCount[0]?.value ?? 0),
				playlistCount: Number(pCount[0]?.value ?? 0),
				tidalAuthCount: Number(tCount[0]?.value ?? 0)
			};
		} catch {
			return {
				dbLatencyMs: -1,
				userCount: 0,
				adminCount: 0,
				playlistCount: 0,
				tidalAuthCount: 0
			};
		}
	})();

	const mem = process.memoryUsage();
	const tidalConn = await getConnectionStatus().catch(() => ({
		configured: false,
		connected: false,
		hasWriteScopes: false
	}));

	const users = await getAllUsersWithAdminStatus().catch(() => []);

	return {
		globalInfo: {
			nodeVersion: process.version,
			platform: process.platform,
			uptimeSeconds: Math.floor(process.uptime()),
			memoryRssMb: Math.round(mem.rss / 1024 / 1024),
			memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
			memoryHeapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
			dbLatencyMs: dbStats.dbLatencyMs,
			userCount: dbStats.userCount,
			adminCount: dbStats.adminCount,
			playlistCount: dbStats.playlistCount,
			tidalAuthCount: dbStats.tidalAuthCount,
			tidal: {
				configured: tidalConn.configured,
				connected: tidalConn.connected,
				hasWriteScopes: Boolean(tidalConn.hasWriteScopes)
			}
		},
		users,
		currentUserId: currentUser.id,
		isFirstAdmin: Boolean(event.locals.isFirstAdministrator)
	};
};

export const actions: Actions = {
	promote: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'promote');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		const success = await addAdministrator(targetUserId);
		if (!success) return fail(500, { error: 'Failed to promote user' });

		return { success: true, message: 'User promoted to administrator' };
	},

	demote: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'demote');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		const success = await removeAdministrator(targetUserId);
		if (!success) return fail(500, { error: 'Failed to demote administrator' });

		return { success: true, message: 'Administrator demoted to user' };
	},

	kick: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'kick');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		const success = await kickUser(targetUserId);
		if (!success) return fail(500, { error: 'Failed to kick user' });

		return { success: true, message: 'User removed from system' };
	},

	ban: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		const reason = String(data.get('reason') ?? '').trim() || undefined;
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'ban');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		await setUserStatus(targetUserId, 'banned', reason);
		return { success: true, message: 'User account banned' };
	},

	archive: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		const reason = String(data.get('reason') ?? '').trim() || undefined;
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'archive');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		await setUserStatus(targetUserId, 'archived', reason);
		return { success: true, message: 'User account archived' };
	},

	unban: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'unban');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		await setUserStatus(targetUserId, 'active');
		return { success: true, message: 'User status restored to active' };
	},

	unarchive: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const targetUserId = String(data.get('targetUserId') ?? '').trim();
		if (!targetUserId) return fail(400, { error: 'Missing target user ID' });

		const check = await canManageUser(currentUser.id, targetUserId, 'unban');
		if (!check.allowed) {
			return fail(403, { error: check.reason ?? 'Action not permitted' });
		}

		await setUserStatus(targetUserId, 'active');
		return { success: true, message: 'User account unarchived' };
	},

	createUser: async (event) => {
		const currentUser = event.locals.user;
		if (!currentUser || !event.locals.isAdministrator) {
			throw error(403, 'Forbidden');
		}

		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const makeAdmin = data.get('makeAdmin') === 'on' || data.get('makeAdmin') === 'true';

		if (!name || !email || !password) {
			return fail(400, { error: 'Name, email, and password are required' });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters long' });
		}

		try {
			const res = await auth.api.signUpEmail({
				body: { name, email, password, callbackURL: '/app' }
			});

			if (res?.user?.id && makeAdmin) {
				await addAdministrator(res.user.id);
			}

			return { success: true, message: 'User created successfully' };
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to create user account';
			return fail(400, { error: msg });
		}
	}
};
